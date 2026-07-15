import { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type { Sheet } from '../../models/sheet/Sheet'
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

  let next: CharacterCustomSystemState = {
    ...state,
    fields: { ...state.fields },
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([id, resource]) => [id, { ...resource }]),
    ),
  }

  for (const resource of definition.resources) {
    if (!resource.maximumFormula) continue
    const result = evaluateCustomFormula(
      resource.maximumFormula,
      definition,
      next,
      character,
    )
    if (!result.ok || typeof result.value !== 'number') continue
    next.resources[resource.id] = {
      ...(next.resources[resource.id] ?? { current: resource.initialValue ?? 0 }),
      maximum: result.value,
    }
  }

  for (const field of definition.fields) {
    if (field.type !== 'formula') continue
    const result = evaluateCustomFormula(field.formula, definition, next, character)
    if (!result.ok) {
      delete next.fields[field.id]
      continue
    }
    next.fields[field.id] = result.value
  }

  return next
}

function installPatch(): void {
  if (installed) return
  installed = true

  const originalWithSheet = CharacterTemplate.prototype.withSheet

  CharacterTemplate.prototype.withSheet = function <K extends keyof Sheet>(
    key: K,
    value: Sheet[K],
  ): CharacterTemplate {
    if (key !== 'customSystems' || !Array.isArray(value)) {
      return originalWithSheet.call(this, key, value)
    }

    const recalculated = (value as CharacterCustomSystemState[]).map((state) =>
      recalculateCustomSystemState(state, this),
    ) as Sheet[K]

    return originalWithSheet.call(this, key, recalculated)
  }
}
