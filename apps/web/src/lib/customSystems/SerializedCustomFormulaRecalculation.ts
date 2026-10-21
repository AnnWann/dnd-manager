import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import { evaluateCustomFormula } from './CustomFormulaEngine.js'
import { getCustomSystemFormulaOverride, formulaOverrideKey } from './CustomSystemFormulaOverrides.js'

/**
 * Server-safe formula materialization for serialized character sheets.
 *
 * Do not import CharacterTemplate or its browser-oriented dependencies here:
 * Vercel executes the Creation handler as native Node ESM. The browser's
 * CharacterTemplate module imports extensionless dependencies that fail at
 * module initialization, even for unauthenticated GET requests.
 */
type StoredCharacter = {
  sheet?: {
    classes?: Array<{ className: string; level: number }>
    attributes?: Record<string, number>
    stats?: Record<string, number | boolean>
    HP?: { current?: number; currentMax?: number; max?: number; temporary?: number }
    customSystems?: CharacterCustomSystemState[]
  }
}

type VariableValue = number | string | boolean
type Resolved = { found: true; value: VariableValue } | { found: false }
const UNRESOLVED: Resolved = { found: false }
const CHARACTER_VARIABLE = /\bcharacter\.[A-Za-z0-9_.-]+/g
const ATTRIBUTE_VARIABLE = /\bfield\.([A-Za-z0-9_-]+)\.(modifier|score|save)\b/g

export function recalculateSerializedCustomSystem(
  state: CharacterCustomSystemState,
  definition: CustomSystemDefinition | undefined,
  snapshot: StoredCharacter,
): CharacterCustomSystemState {
  if (!definition || definition.id !== state.systemId || !state.enabled) return state

  const rawExpressions = [
    ...definition.fields.filter((field) => field.type === 'formula').map((field) =>
      getCustomSystemFormulaOverride(state, formulaOverrideKey('field', field.id)) ?? field.formula,
    ),
    ...definition.resources.flatMap((resource) => {
      const formula = getCustomSystemFormulaOverride(state, formulaOverrideKey('resourceMaximum', resource.id))
        ?? resource.maximumFormula
      return formula ? [formula] : []
    }),
  ]
  const referencePaths = new Set<string>()
  const attributePaths = new Set<string>()
  for (const expression of rawExpressions) {
    for (const match of expression.matchAll(CHARACTER_VARIABLE)) referencePaths.add(match[0])
    for (const match of expression.matchAll(ATTRIBUTE_VARIABLE)) attributePaths.add(match[0])
  }

  const virtualValues = new Map<string, VariableValue>()
  for (const path of referencePaths) {
    const resolved = resolveRawCharacterPath(path, snapshot)
    // Never persist partially evaluated formulas as if missing values were 0.
    // The client has access to full effective stats and can calculate those.
    if (resolved.found) virtualValues.set(path, resolved.value)
  }

  for (const path of attributePaths) {
    const match = path.match(/^field\.([A-Za-z0-9_-]+)\.(modifier|score|save)$/)
    if (!match) continue
    const field = definition.fields.find((entry) => entry.id === match[1])
    if (!field || field.type !== 'attribute') continue
    const attribute = state.fields[field.id] ?? field.defaultValue
    const score = typeof attribute === 'string' ? snapshot.sheet?.attributes?.[attribute] : undefined
    if (typeof score !== 'number' || !Number.isFinite(score)) continue
    virtualValues.set(path, match[2] === 'score' ? score : Math.floor((score - 10) / 2))
  }

  const references = Array.from(virtualValues.keys()).sort((left, right) => right.length - left.length)
  const virtualFieldIds = new Map(references.map((path, index) => [path, `__serialized_formula_${index}`]))
  const translate = (formula: string): string =>
    references.reduce((text, path) => {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return text.replace(
        new RegExp(`(^|[^A-Za-z0-9_.-])${escaped}(?=$|[^A-Za-z0-9_.-])`, 'g'),
        (_match, prefix: string) => `${prefix}field.${virtualFieldIds.get(path)}`,
      )
    }, formula)

  const calculatedDefinition: CustomSystemDefinition = {
    ...definition,
    fields: [
      ...definition.fields.map((field) => field.type === 'formula'
        ? { ...field, formula: translate(getCustomSystemFormulaOverride(state, formulaOverrideKey('field', field.id)) ?? field.formula) }
        : field),
      ...references.map((path) => ({
        id: virtualFieldIds.get(path)!,
        name: path,
        type: typeof virtualValues.get(path) === 'boolean' ? 'boolean' as const :
          typeof virtualValues.get(path) === 'number' ? 'number' as const : 'text' as const,
      })),
    ],
    resources: definition.resources.map((resource) => ({
      ...resource,
      maximumFormula: resource.maximumFormula
        ? translate(getCustomSystemFormulaOverride(state, formulaOverrideKey('resourceMaximum', resource.id)) ?? resource.maximumFormula)
        : resource.maximumFormula,
    })),
  }
  const virtualFields = Object.fromEntries(
    references.map((path) => [virtualFieldIds.get(path)!, virtualValues.get(path)!]),
  )

  let next = state
  function evaluate(formula: string) {
    return evaluateCustomFormula(translate(formula), calculatedDefinition, {
      ...next,
      fields: { ...next.fields, ...virtualFields },
    })
  }

  // Fields first, because resource maxima can depend on their results.
  for (const field of definition.fields) {
    if (field.type !== 'formula') continue
    const expression = getCustomSystemFormulaOverride(next, formulaOverrideKey('field', field.id)) ?? field.formula
    if (hasUnresolvedReferences(expression, virtualValues)) continue
    const result = evaluate(expression)
    if (!result.ok || !isExpectedType(result.value, field.resultType)) continue
    if (Object.is(next.fields[field.id], result.value)) continue
    next = { ...next, fields: { ...next.fields, [field.id]: result.value } }
  }
  for (const resource of definition.resources) {
    const expression = getCustomSystemFormulaOverride(next, formulaOverrideKey('resourceMaximum', resource.id))
      ?? resource.maximumFormula
    if (!expression || resource.maximumMode === 'manual') continue
    const manualMaximum = resource.maximumMode === 'formulaWithOverride'
      && next.resources[resource.id]?.maximum !== undefined
      && !getCustomSystemFormulaOverride(next, formulaOverrideKey('resourceMaximum', resource.id))
    if (manualMaximum || hasUnresolvedReferences(expression, virtualValues)) continue
    const result = evaluate(expression)
    if (!result.ok || typeof result.value !== 'number' || !Number.isFinite(result.value)) continue
    const previous = next.resources[resource.id]
    const current = Math.min(previous?.current ?? resource.initialValue ?? 0, result.value)
    if (previous?.maximum === result.value && previous.current === current) continue
    next = {
      ...next,
      resources: {
        ...next.resources,
        [resource.id]: {
          ...(previous ?? { current }),
          maximum: result.value,
          current,
        },
      },
    }
  }
  return next
}

function hasUnresolvedReferences(expression: string, values: Map<string, VariableValue>): boolean {
  return Array.from(expression.matchAll(CHARACTER_VARIABLE), (match) => match[0])
    .some((path) => !values.has(path))
}

function isExpectedType(value: unknown, kind: 'number' | 'boolean' | 'text' | 'dice'): boolean {
  return typeof value === (kind === 'dice' || kind === 'text' ? 'string' : kind)
}

function resolveRawCharacterPath(path: string, character: StoredCharacter): Resolved {
  const sheet = character.sheet
  if (!sheet) return UNRESOLVED
  const classes = sheet.classes ?? []
  const level = classes.reduce((sum, entry) => sum + Math.max(0, Number(entry.level) || 0), 0)
  if (path === 'character.level') return { found: true, value: level }
  if (path === 'character.proficiencyBonus') {
    return { found: true, value: Math.min(6, 2 + Math.floor((Math.max(1, level) - 1) / 4)) }
  }
  const aggregateCustom = path.match(/^character\.class\.custom\.(level|present)$/)
  const classMatch = path.match(/^character\.class\.([A-Za-z0-9_-]+)\.(level|present)$/)
  if (aggregateCustom || classMatch) {
    const id = classMatch?.[1]
    const total = classes.reduce((sum, entry) =>
      sum + ((id === 'custom'
        ? entry.className === '__custom__' || entry.className.startsWith('__custom__-')
        : entry.className === id)
        ? Math.max(0, Number(entry.level) || 0) : 0), 0)
    return { found: true, value: path.endsWith('.present') ? total > 0 : total }
  }
  const attributeMatch = path.match(/^character\.(attribute|attributeModifier|save)\.(str|dex|con|int|wis|cha)$/)
  if (attributeMatch) {
    const score = sheet.attributes?.[attributeMatch[2]]
    if (typeof score !== 'number' || !Number.isFinite(score)) return UNRESOLVED
    return { found: true, value: attributeMatch[1] === 'attribute' ? score : Math.floor((score - 10) / 2) }
  }
  const statPaths: Record<string, number | boolean | undefined> = {
    'character.armorClass': Number(sheet.stats?.armorClass),
    'character.initiative': Number(sheet.stats?.initiative),
    'character.passivePerception': Number(sheet.stats?.passive_perception),
    'character.mobility': Number(sheet.stats?.mobility),
    'character.exhaustion': Number(sheet.stats?.exhaustion ?? 0),
    'character.inspiration': sheet.stats?.inspiration === true,
    'character.hp.current': sheet.HP?.current,
    'character.hp.maximum': sheet.HP?.currentMax ?? sheet.HP?.max,
    'character.hp.temporary': sheet.HP?.temporary ?? 0,
  }
  if (Object.hasOwn(statPaths, path)) {
    const value = statPaths[path]
    return typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean'
      ? { found: true, value } : UNRESOLVED
  }
  const crossSystem = path.match(/^character\.customSystem\.([^.]+)\.(field|resource)\.([^.]+)(?:\.(current|maximum|temporary))?$/)
  if (crossSystem) {
    const [, id, kind, key, property] = crossSystem
    const system = sheet.customSystems?.find((entry) => entry.systemId === id)
    const value = kind === 'field'
      ? system?.fields[key]
      : system?.resources[key]?.[property === 'temporary' ? 'temporary' : property === 'maximum' ? 'maximum' : 'current']
    return typeof value === 'number' && Number.isFinite(value) || typeof value === 'string' || typeof value === 'boolean'
      ? { found: true, value } : UNRESOLVED
  }
  return UNRESOLVED
}
