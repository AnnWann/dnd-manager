import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from '../../models/characters/CharacterTemplate'
import type { CustomNumericOperation, CustomSystemEventType } from '../../models/customSystems/CustomAutomationDefinition'
import type { CustomResourceDefinition, CustomResourceRecoveryRule } from '../../models/customSystems/CustomResourceDefinition'
import type { CharacterCustomSystemState } from '../../models/customSystems/CustomSystemDefinition'
import { evaluateCustomFormula } from './CustomFormulaEngineWithCharacter'

let installed = false
let resolveDefinition: ((systemId: string) => import('../../models/customSystems/CustomSystemDefinition').CustomSystemDefinition | undefined) | undefined

export function configureCustomFormulaRuntime(
  resolver: (systemId: string) => import('../../models/customSystems/CustomSystemDefinition').CustomSystemDefinition | undefined,
): void {
  resolveDefinition = resolver
  installPatch()
}

export function recalculateCustomSystemState(
  state: CharacterCustomSystemState,
  character?: CharacterTemplate,
): CharacterCustomSystemState {
  const definition = resolveDefinition?.(state.systemId)
  if (!definition) return state

  const hasCalculatedResources = definition.resources.some((resource) =>
    Boolean(resource.maximumFormula) && (resource.maximumMode ?? 'formula') !== 'manual',
  )
  const hasCalculatedFields = definition.fields.some((field) => field.type === 'formula')
  if (!hasCalculatedResources && !hasCalculatedFields) return state

  let next = state

  for (const resource of definition.resources) {
    if (!resource.maximumFormula) continue
    const mode = resource.maximumMode ?? 'formula'
    const currentState = next.resources[resource.id]
    const hasManualOverride = mode === 'formulaWithOverride' && currentState?.maximum !== undefined
    if (mode === 'manual' || hasManualOverride) continue

    const result = evaluateCustomFormula(
      resource.maximumFormula,
      definition,
      next,
      character,
    )
    if (!result.ok || typeof result.value !== 'number') continue

    const previousCurrent = currentState?.current ?? resource.initialValue ?? 0
    const nextCurrent = Math.min(previousCurrent, result.value)
    if (
      currentState &&
      currentState.maximum === result.value &&
      currentState.current === nextCurrent
    ) {
      continue
    }

    next = {
      ...next,
      resources: {
        ...next.resources,
        [resource.id]: {
          ...(currentState ?? { current: resource.initialValue ?? 0 }),
          maximum: result.value,
          current: nextCurrent,
        },
      },
    }
  }

  for (const field of definition.fields) {
    if (field.type !== 'formula') continue
    const result = evaluateCustomFormula(field.formula, definition, next, character)
    if (!result.ok) {
      if (!(field.id in next.fields)) continue
      const fields = { ...next.fields }
      delete fields[field.id]
      next = { ...next, fields }
      continue
    }
    if (Object.is(next.fields[field.id], result.value)) continue
    next = {
      ...next,
      fields: {
        ...next.fields,
        [field.id]: result.value,
      },
    }
  }

  return next
}

export function applyCustomSystemRestRecovery(
  character: CharacterTemplate,
  restKind: 'short' | 'long',
  recoveryFraction = 1,
): CharacterTemplate {
  const systems = character.get('sheet').customSystems ?? []
  if (!systems.length) return character

  const event: CustomSystemEventType = restKind === 'short'
    ? 'shortRestCompleted'
    : 'longRestCompleted'

  const recovered = systems.map((state) => {
    const definition = resolveDefinition?.(state.systemId)
    if (!definition || state.enabled === false) return state

    let next: CharacterCustomSystemState = {
      ...state,
      fields: { ...state.fields },
      resources: Object.fromEntries(
        Object.entries(state.resources).map(([id, resource]) => [id, { ...resource }]),
      ),
      abilities: state.abilities.map((ability) => ({
        ...ability,
        values: { ...ability.values },
        usage: ability.usage ? { ...ability.usage } : undefined,
      })),
    }

    for (const resource of definition.resources) {
      const rules = (resource.recoveryRules ?? []).filter((rule) =>
        rule.enabled !== false && rule.event === event,
      )
      for (const rule of rules) {
        next = applyRecoveryRule(character, definition, next, resource, rule, recoveryFraction)
      }
    }

    return next
  })

  return character.withSheet('customSystems', recovered)
}

function applyRecoveryRule(
  character: CharacterTemplate,
  definition: import('../../models/customSystems/CustomSystemDefinition').CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resource: CustomResourceDefinition,
  rule: CustomResourceRecoveryRule,
  recoveryFraction: number,
): CharacterCustomSystemState {
  const currentState = state.resources[resource.id]
  if (!currentState) return state
  const target = rule.target ?? 'current'
  const current = target === 'temporary' ? currentState.temporary ?? 0 : currentState.current
  const maximum = currentState.maximum ?? resource.maximum
  const scale = rule.scaleWithRestFraction === false ? 1 : Math.max(0, Math.min(1, recoveryFraction))
  const amount = resolveRecoveryAmount(rule, definition, state, character)
  const nextValue = applyRecoveryOperation(current, maximum, rule.operation, amount, scale)
  const normalized = target === 'temporary'
    ? Math.max(0, nextValue)
    : clamp(nextValue, resource.minimum, maximum)

  return {
    ...state,
    resources: {
      ...state.resources,
      [resource.id]: target === 'temporary'
        ? { ...currentState, temporary: normalized }
        : { ...currentState, current: normalized },
    },
  }
}

function resolveRecoveryAmount(
  rule: CustomResourceRecoveryRule,
  definition: import('../../models/customSystems/CustomSystemDefinition').CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): number {
  if (rule.formula?.trim()) {
    const result = evaluateCustomFormula(rule.formula, definition, state, character)
    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) {
      return result.value
    }
  }
  return rule.value ?? 0
}

function applyRecoveryOperation(
  current: number,
  maximum: number | undefined,
  operation: CustomNumericOperation,
  amount: number,
  fraction: number,
): number {
  if (operation === 'resetToMaximum') {
    if (maximum === undefined) return current
    const missing = Math.max(0, maximum - current)
    return current + Math.ceil(missing * fraction)
  }
  if (operation === 'add') return current + amount * fraction
  if (operation === 'subtract') return current - amount * fraction
  if (operation === 'multiply') return current * (fraction >= 1 ? amount : 1 + ((amount - 1) * fraction))
  return fraction >= 1 ? amount : current + ((amount - current) * fraction)
}

function clamp(value: number, minimum?: number, maximum?: number): number {
  const lower = minimum === undefined ? value : Math.max(minimum, value)
  return maximum === undefined ? lower : Math.min(maximum, lower)
}

function installPatch(): void {
  if (installed) return
  installed = true

  const originalWithPatch = CharacterTemplate.prototype.withPatch

  CharacterTemplate.prototype.withPatch = function (
    patch: Partial<CharacterTemplateProps>,
  ): CharacterTemplate {
    const updated = originalWithPatch.call(this, patch)
    const systems = updated.get('sheet').customSystems
    if (!Array.isArray(systems) || systems.length === 0) return updated

    const recalculated = systems.map((state) =>
      recalculateCustomSystemState(state, updated),
    )

    if (recalculated.every((state, index) => state === systems[index])) return updated

    return originalWithPatch.call(updated, {
      sheet: {
        ...updated.get('sheet'),
        customSystems: recalculated,
      },
    })
  }
}
