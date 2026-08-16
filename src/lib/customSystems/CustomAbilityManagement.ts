import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type {
  CustomAbilityAcquisitionDefinition,
  CustomAbilityTypeDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type {
  CharacterCustomSystemState,
  CustomAbilityAcquisitionExceptionState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import { evaluateCustomFormula } from './CustomFormulaEngineWithCharacter'

type AbilityTypeWithPartialAcquisition = Omit<CustomAbilityTypeDefinition, 'acquisition'> & {
  acquisition?: Partial<CustomAbilityAcquisitionDefinition>
}

export type CustomAbilityAvailability = {
  learned: boolean
  prepared: boolean
  canUse: boolean
  mode: CustomAbilityAcquisitionDefinition['mode']
}

export function initializeCustomAbilityProgress(
  type: AbilityTypeWithPartialAcquisition,
  ability: CustomAbilityInstance,
): CustomAbilityInstance {
  const acquisition = normalizeAcquisition(type.acquisition)
  const learned = acquisition.mode === 'granted'
    || acquisition.mode === 'prepared'
    || acquisition.defaultLearned !== false
  const prepared = acquisition.mode === 'granted'
    || acquisition.mode === 'learned'
    || Boolean(acquisition.defaultPrepared)

  return {
    ...ability,
    learned,
    prepared: learned ? prepared : false,
  }
}

export function getCustomAbilityAvailability(
  type: AbilityTypeWithPartialAcquisition,
  ability: CustomAbilityInstance,
  state?: CharacterCustomSystemState,
): CustomAbilityAvailability {
  const acquisition = normalizeAcquisition(type.acquisition)
  const exception = state
    ? getCustomAbilityAcquisitionException(state, ability.abilityTypeId)
    : undefined
  const alwaysPrepared = Boolean(exception?.alwaysPreparedAbilityIds?.includes(ability.id))
  const alwaysLearned = alwaysPrepared
    || Boolean(exception?.alwaysLearnedAbilityIds?.includes(ability.id))
  const learned = acquisition.mode === 'granted'
    || acquisition.mode === 'prepared'
    || alwaysLearned
    || ability.learned !== false
  const prepared = acquisition.mode === 'granted'
    || acquisition.mode === 'learned'
    || alwaysPrepared
    || ability.prepared === true

  return {
    learned,
    prepared,
    canUse: learned && prepared && ability.enabled !== false,
    mode: acquisition.mode,
  }
}

export function setCustomAbilityLearned(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  learned: boolean,
  character?: CharacterTemplate,
): CharacterCustomSystemState {
  const ability = requireAbility(state, abilityId)
  const type = requireType(definition, ability.abilityTypeId)
  const acquisition = normalizeAcquisition(type.acquisition)
  const exception = getCustomAbilityAcquisitionException(state, type.id)
  const forced = exception.alwaysPreparedAbilityIds?.includes(abilityId)
    || exception.alwaysLearnedAbilityIds?.includes(abilityId)

  if (acquisition.mode === 'granted' || acquisition.mode === 'prepared') return state
  if (!learned && forced) return state
  if (learned) assertLimit(definition, state, type, 'learned', character, abilityId)

  return replaceAbility(state, abilityId, {
    ...ability,
    learned,
    prepared: learned ? ability.prepared : false,
  })
}

export function setCustomAbilityPrepared(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  prepared: boolean,
  character?: CharacterTemplate,
): CharacterCustomSystemState {
  const ability = requireAbility(state, abilityId)
  const type = requireType(definition, ability.abilityTypeId)
  const acquisition = normalizeAcquisition(type.acquisition)
  const availability = getCustomAbilityAvailability(type, ability, state)
  const exception = getCustomAbilityAcquisitionException(state, type.id)
  const forced = exception.alwaysPreparedAbilityIds?.includes(abilityId)

  if (acquisition.mode === 'granted' || acquisition.mode === 'learned') return state
  if (!prepared && forced) return state
  if (!availability.learned) throw new Error('A habilidade precisa ser aprendida antes de ser preparada.')
  if (prepared) assertLimit(definition, state, type, 'prepared', character, abilityId)

  return replaceAbility(state, abilityId, { ...ability, prepared })
}

export function getCustomAbilityLimit(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: CustomAbilityTypeDefinition,
  kind: 'learned' | 'prepared',
  character?: CharacterTemplate,
): number | undefined {
  const acquisition = normalizeAcquisition(type.acquisition)
  const fixed = kind === 'learned' ? acquisition.learnedLimit : acquisition.preparedLimit
  const formula = kind === 'learned' ? acquisition.learnedLimitFormula : acquisition.preparedLimitFormula
  let base = fixed

  if (formula?.trim()) {
    const result = evaluateCustomFormula(formula, definition, state, character)
    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) {
      base = Math.max(0, Math.floor(result.value))
    }
  }

  if (base === undefined) return undefined
  const exception = getCustomAbilityAcquisitionException(state, type.id)
  const bonus = kind === 'learned'
    ? exception.extraLearnedSlots ?? 0
    : exception.extraPreparedSlots ?? 0
  return Math.max(0, Math.floor(base + Math.max(0, bonus)))
}

export function countCustomAbilities(
  state: CharacterCustomSystemState,
  typeId: string,
  kind: 'learned' | 'prepared',
): number {
  const exception = getCustomAbilityAcquisitionException(state, typeId)
  const exemptIds = new Set(
    kind === 'learned'
      ? [
          ...(exception.alwaysLearnedAbilityIds ?? []),
          ...(exception.alwaysPreparedAbilityIds ?? []),
        ]
      : exception.alwaysPreparedAbilityIds ?? [],
  )

  return state.abilities.filter((ability) => {
    if (ability.abilityTypeId !== typeId || exemptIds.has(ability.id)) return false
    return kind === 'learned' ? ability.learned !== false : ability.prepared === true
  }).length
}

export function getCustomAbilityAcquisitionException(
  state: CharacterCustomSystemState,
  typeId: string,
): CustomAbilityAcquisitionExceptionState {
  return state.abilityAcquisitionExceptions?.[typeId] ?? {}
}

export function setCustomAbilityAcquisitionException(
  state: CharacterCustomSystemState,
  typeId: string,
  value: CustomAbilityAcquisitionExceptionState,
): CharacterCustomSystemState {
  const abilityIds = new Set(
    state.abilities
      .filter((ability) => ability.abilityTypeId === typeId)
      .map((ability) => ability.id),
  )
  const alwaysPreparedAbilityIds = uniqueExistingIds(
    value.alwaysPreparedAbilityIds,
    abilityIds,
  )
  const alwaysLearnedAbilityIds = uniqueExistingIds(
    value.alwaysLearnedAbilityIds,
    abilityIds,
  ).filter((id) => !alwaysPreparedAbilityIds.includes(id))
  const normalized: CustomAbilityAcquisitionExceptionState = {
    extraLearnedSlots: normalizeBonus(value.extraLearnedSlots),
    extraPreparedSlots: normalizeBonus(value.extraPreparedSlots),
    alwaysLearnedAbilityIds,
    alwaysPreparedAbilityIds,
  }
  const hasValue = Boolean(
    normalized.extraLearnedSlots
      || normalized.extraPreparedSlots
      || alwaysLearnedAbilityIds.length
      || alwaysPreparedAbilityIds.length,
  )
  const exceptions = { ...(state.abilityAcquisitionExceptions ?? {}) }

  if (hasValue) exceptions[typeId] = normalized
  else delete exceptions[typeId]

  return {
    ...state,
    abilities: state.abilities.map((ability) => {
      if (ability.abilityTypeId !== typeId) return ability
      if (alwaysPreparedAbilityIds.includes(ability.id)) {
        return { ...ability, learned: true, prepared: true }
      }
      if (alwaysLearnedAbilityIds.includes(ability.id)) {
        return { ...ability, learned: true }
      }
      return ability
    }),
    abilityAcquisitionExceptions: Object.keys(exceptions).length ? exceptions : undefined,
  }
}

export function isCustomAbilityAlwaysLearned(
  state: CharacterCustomSystemState,
  typeId: string,
  abilityId: string,
): boolean {
  const exception = getCustomAbilityAcquisitionException(state, typeId)
  return Boolean(
    exception.alwaysLearnedAbilityIds?.includes(abilityId)
      || exception.alwaysPreparedAbilityIds?.includes(abilityId),
  )
}

export function isCustomAbilityAlwaysPrepared(
  state: CharacterCustomSystemState,
  typeId: string,
  abilityId: string,
): boolean {
  return Boolean(
    getCustomAbilityAcquisitionException(state, typeId)
      .alwaysPreparedAbilityIds?.includes(abilityId),
  )
}

function assertLimit(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: CustomAbilityTypeDefinition,
  kind: 'learned' | 'prepared',
  character?: CharacterTemplate,
  abilityId?: string,
) {
  const exception = getCustomAbilityAcquisitionException(state, type.id)
  const exempt = abilityId && (
    kind === 'learned'
      ? exception.alwaysLearnedAbilityIds?.includes(abilityId)
        || exception.alwaysPreparedAbilityIds?.includes(abilityId)
      : exception.alwaysPreparedAbilityIds?.includes(abilityId)
  )
  if (exempt) return

  const limit = getCustomAbilityLimit(definition, state, type, kind, character)
  if (limit === undefined) return
  const current = countCustomAbilities(state, type.id, kind)
  if (current >= limit) {
    throw new Error(`O limite de habilidades ${kind === 'learned' ? 'aprendidas' : 'preparadas'} para “${type.name}” é ${limit}.`)
  }
}

function normalizeAcquisition(value?: Partial<CustomAbilityAcquisitionDefinition>): CustomAbilityAcquisitionDefinition {
  return {
    mode: value?.mode ?? 'learned',
    learnedLimit: value?.learnedLimit,
    learnedLimitFormula: value?.learnedLimitFormula,
    preparedLimit: value?.preparedLimit,
    preparedLimitFormula: value?.preparedLimitFormula,
    defaultLearned: value?.defaultLearned ?? true,
    defaultPrepared: value?.defaultPrepared ?? false,
    preparationReset: value?.preparationReset ?? 'manual',
  }
}

function requireAbility(state: CharacterCustomSystemState, abilityId: string) {
  const ability = state.abilities.find((entry) => entry.id === abilityId)
  if (!ability) throw new Error(`Habilidade “${abilityId}” não encontrada.`)
  return ability
}

function requireType(definition: CustomSystemDefinition, typeId: string) {
  const type = definition.abilityTypes.find((entry) => entry.id === typeId)
  if (!type) throw new Error(`Tipo de habilidade “${typeId}” não encontrado.`)
  return type
}

function replaceAbility(
  state: CharacterCustomSystemState,
  abilityId: string,
  next: CustomAbilityInstance,
): CharacterCustomSystemState {
  return {
    ...state,
    abilities: state.abilities.map((entry) => entry.id === abilityId ? next : entry),
  }
}

function normalizeBonus(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  const normalized = Math.max(0, Math.floor(Number(value) || 0))
  return normalized > 0 ? normalized : undefined
}

function uniqueExistingIds(values: string[] | undefined, valid: Set<string>): string[] {
  return Array.from(new Set(values ?? [])).filter((id) => valid.has(id))
}
