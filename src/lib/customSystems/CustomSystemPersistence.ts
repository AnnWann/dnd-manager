import type { CharacterTemplateProps } from '../../models/characters/CharacterTemplate'
import type { JsonValue } from '../../models/customSystems/CustomGenerals'
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomResourceState,
} from '../../models/customSystems/CustomSystemDefinition'

const MAX_SYSTEMS_PER_CHARACTER = 100
const MAX_ABILITIES_PER_SYSTEM = 1000
const MAX_FIELDS_PER_SYSTEM = 2000
const MAX_RESOURCES_PER_SYSTEM = 500
const MAX_JSON_DEPTH = 20
const MAX_JSON_NODES = 20_000

export interface CustomSystemPersistenceIssue {
  code:
    | 'invalidCustomSystems'
    | 'invalidSystem'
    | 'duplicateSystem'
    | 'invalidFieldValue'
    | 'invalidResource'
    | 'invalidAbility'
    | 'duplicateAbility'
    | 'limitExceeded'
  path: string
  message: string
}

export interface CustomSystemPersistenceResult<T> {
  value: T
  issues: CustomSystemPersistenceIssue[]
}

export function normalizeCharacterCustomSystems(
  value: unknown,
): CustomSystemPersistenceResult<CharacterCustomSystemState[]> {
  const issues: CustomSystemPersistenceIssue[] = []

  if (value === undefined || value === null) {
    return { value: [], issues }
  }

  if (!Array.isArray(value)) {
    issues.push({
      code: 'invalidCustomSystems',
      path: 'customSystems',
      message: 'Custom systems must be stored as an array.',
    })
    return { value: [], issues }
  }

  const systems = new Map<string, CharacterCustomSystemState>()

  for (const [index, rawSystem] of value
    .slice(0, MAX_SYSTEMS_PER_CHARACTER)
    .entries()) {
    const normalized = normalizeSystem(rawSystem, `customSystems.${index}`)
    issues.push(...normalized.issues)
    if (!normalized.value) continue

    const existing = systems.get(normalized.value.systemId)
    if (existing) {
      issues.push({
        code: 'duplicateSystem',
        path: `customSystems.${index}.systemId`,
        message: `Duplicate custom system ${normalized.value.systemId} was merged.`,
      })
      systems.set(
        normalized.value.systemId,
        mergeDuplicateSystemStates(existing, normalized.value),
      )
    } else {
      systems.set(normalized.value.systemId, normalized.value)
    }
  }

  if (value.length > MAX_SYSTEMS_PER_CHARACTER) {
    issues.push({
      code: 'limitExceeded',
      path: 'customSystems',
      message: `Only the first ${MAX_SYSTEMS_PER_CHARACTER} custom systems were preserved.`,
    })
  }

  return { value: [...systems.values()], issues }
}

export function preserveCharacterCustomSystems(
  character: CharacterTemplateProps,
): CustomSystemPersistenceResult<CharacterTemplateProps> {
  const normalized = normalizeCharacterCustomSystems(
    character.sheet?.customSystems,
  )

  const same =
    JSON.stringify(character.sheet?.customSystems ?? []) ===
    JSON.stringify(normalized.value)

  if (same) return { value: character, issues: normalized.issues }

  return {
    value: {
      ...character,
      sheet: {
        ...character.sheet,
        customSystems: normalized.value,
      },
    },
    issues: normalized.issues,
  }
}

export function preserveAppStateCustomSystems<T extends { characters: CharacterTemplateProps[] }>(
  state: T,
): CustomSystemPersistenceResult<T> {
  const issues: CustomSystemPersistenceIssue[] = []
  let changed = false

  const characters = state.characters.map((character) => {
    const normalized = preserveCharacterCustomSystems(character)
    issues.push(
      ...normalized.issues.map((issue) => ({
        ...issue,
        path: `characters.${character.id}.${issue.path}`,
      })),
    )
    if (normalized.value !== character) changed = true
    return normalized.value
  })

  return {
    value: changed ? ({ ...state, characters } as T) : state,
    issues,
  }
}

export function isSafePersistedJson(value: unknown): value is JsonValue {
  const state = { nodes: 0 }
  return isSafeJsonValue(value, 0, state)
}

function normalizeSystem(
  value: unknown,
  path: string,
): CustomSystemPersistenceResult<CharacterCustomSystemState | undefined> {
  const issues: CustomSystemPersistenceIssue[] = []
  if (!isRecord(value)) {
    return {
      value: undefined,
      issues: [{ code: 'invalidSystem', path, message: 'Invalid custom system state.' }],
    }
  }

  const systemId = readNonEmptyString(value.systemId)
  if (!systemId) {
    return {
      value: undefined,
      issues: [{ code: 'invalidSystem', path: `${path}.systemId`, message: 'Missing systemId.' }],
    }
  }

  const fields: Record<string, JsonValue> = {}
  if (isRecord(value.fields)) {
    for (const [fieldId, fieldValue] of Object.entries(value.fields).slice(
      0,
      MAX_FIELDS_PER_SYSTEM,
    )) {
      if (isSafePersistedJson(fieldValue)) {
        fields[fieldId] = cloneJson(fieldValue)
      } else {
        issues.push({
          code: 'invalidFieldValue',
          path: `${path}.fields.${fieldId}`,
          message: 'The field value was not safe JSON and was omitted.',
        })
      }
    }
  }

  const resources: Record<string, CustomResourceState> = {}
  if (isRecord(value.resources)) {
    for (const [resourceId, rawResource] of Object.entries(value.resources).slice(
      0,
      MAX_RESOURCES_PER_SYSTEM,
    )) {
      const resource = normalizeResource(rawResource)
      if (resource) resources[resourceId] = resource
      else {
        issues.push({
          code: 'invalidResource',
          path: `${path}.resources.${resourceId}`,
          message: 'Invalid resource state was omitted.',
        })
      }
    }
  }

  const abilities: CustomAbilityInstance[] = []
  const abilityIds = new Set<string>()
  if (Array.isArray(value.abilities)) {
    for (const [abilityIndex, rawAbility] of value.abilities
      .slice(0, MAX_ABILITIES_PER_SYSTEM)
      .entries()) {
      const ability = normalizeAbility(rawAbility)
      if (!ability) {
        issues.push({
          code: 'invalidAbility',
          path: `${path}.abilities.${abilityIndex}`,
          message: 'Invalid custom ability was omitted.',
        })
        continue
      }
      if (abilityIds.has(ability.id)) {
        issues.push({
          code: 'duplicateAbility',
          path: `${path}.abilities.${abilityIndex}.id`,
          message: `Duplicate ability ${ability.id} was omitted.`,
        })
        continue
      }
      abilityIds.add(ability.id)
      abilities.push(ability)
    }
  }

  return {
    value: {
      systemId,
      systemVersion: normalizeNonNegativeInteger(value.systemVersion),
      enabled: value.enabled !== false,
      fields,
      resources,
      abilities,
    },
    issues,
  }
}

function normalizeResource(value: unknown): CustomResourceState | undefined {
  if (!isRecord(value)) return undefined
  const current = finiteNumber(value.current)
  if (current === undefined) return undefined

  const maximum = finiteNumber(value.maximum)
  const temporary = finiteNumber(value.temporary)

  return {
    current,
    ...(maximum !== undefined ? { maximum } : {}),
    ...(temporary !== undefined ? { temporary } : {}),
  }
}

function normalizeAbility(value: unknown): CustomAbilityInstance | undefined {
  if (!isRecord(value)) return undefined
  const id = readNonEmptyString(value.id)
  const abilityTypeId = readNonEmptyString(value.abilityTypeId)
  if (!id || !abilityTypeId) return undefined

  const predefinedAbilityId = readNonEmptyString(value.predefinedAbilityId)
  const values: Record<string, JsonValue> = {}
  if (isRecord(value.values)) {
    for (const [fieldId, fieldValue] of Object.entries(value.values).slice(
      0,
      MAX_FIELDS_PER_SYSTEM,
    )) {
      if (isSafePersistedJson(fieldValue)) values[fieldId] = cloneJson(fieldValue)
    }
  }

  const usage = isRecord(value.usage)
    ? {
        used: normalizeNonNegativeNumber(value.usage.used),
        ...(finiteNumber(value.usage.maximum) !== undefined
          ? { maximum: normalizeNonNegativeNumber(value.usage.maximum) }
          : {}),
      }
    : undefined

  return {
    id,
    abilityTypeId,
    ...(predefinedAbilityId ? { predefinedAbilityId } : {}),
    values,
    ...(usage ? { usage } : {}),
    ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
    ...(typeof value.learned === 'boolean' ? { learned: value.learned } : {}),
    ...(typeof value.prepared === 'boolean' ? { prepared: value.prepared } : {}),
  }
}

function mergeDuplicateSystemStates(
  first: CharacterCustomSystemState,
  second: CharacterCustomSystemState,
): CharacterCustomSystemState {
  const abilities = new Map(first.abilities.map((ability) => [ability.id, ability]))
  for (const ability of second.abilities) abilities.set(ability.id, ability)

  return {
    systemId: first.systemId,
    systemVersion: Math.max(first.systemVersion, second.systemVersion),
    enabled: second.enabled,
    fields: { ...first.fields, ...second.fields },
    resources: { ...first.resources, ...second.resources },
    abilities: [...abilities.values()],
  }
}

function isSafeJsonValue(
  value: unknown,
  depth: number,
  state: { nodes: number },
): value is JsonValue {
  state.nodes += 1
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) {
    return value.every((entry) => isSafeJsonValue(entry, depth + 1, state))
  }
  if (!isRecord(value)) return false
  return Object.entries(value).every(
    ([key, entry]) =>
      key.length <= 500 && isSafeJsonValue(entry, depth + 1, state),
  )
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : undefined
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeNonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.trunc(finiteNumber(value) ?? 0))
}

function normalizeNonNegativeNumber(value: unknown): number {
  return Math.max(0, finiteNumber(value) ?? 0)
}
