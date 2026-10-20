import type { CharacterCustomSystemState, CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

/** Stable, namespaced keys prevent collisions between fields, resources and ability types. */
export function formulaOverrideKey(kind: 'field' | 'resourceMaximum' | 'abilityField', id: string, fieldId?: string): string {
  return kind === 'abilityField' ? `abilityField:${id}:${fieldId ?? ''}` : `${kind}:${id}`
}

export function getCustomSystemFormulaOverride(state: CharacterCustomSystemState, key: string): string | undefined {
  const value = state.formulaOverrides?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** Restricts edits to formulas actually supplied by the installed system. */
export function setCustomSystemFormulaOverride(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  key: string,
  expression: string,
): CharacterCustomSystemState {
  if (state.systemId !== definition.id) throw new Error('O sistema não corresponde ao personagem.')
  const allowed = new Set([
    ...definition.fields.filter((field) => field.type === 'formula').map((field) => formulaOverrideKey('field', field.id)),
    ...definition.resources.filter((resource) => Boolean(resource.maximumFormula) && resource.maximumMode !== 'manual').map((resource) => formulaOverrideKey('resourceMaximum', resource.id)),
    ...definition.abilityTypes.flatMap((type) => type.fields.filter((field) => field.type === 'formula').map((field) => formulaOverrideKey('abilityField', type.id, field.id))),
  ])
  if (!allowed.has(key)) throw new Error('Esta fórmula não permite uma exceção.')
  if (expression.length > 2048) throw new Error('A fórmula não pode exceder 2048 caracteres.')
  const values = { ...(state.formulaOverrides ?? {}) }
  if (expression.trim()) values[key] = expression.trim()
  else delete values[key]
  const resourceId = key.startsWith('resourceMaximum:') ? key.slice('resourceMaximum:'.length) : undefined
  const resettingResource = resourceId && !expression.trim() && Boolean(state.formulaOverrides?.[key])
  const currentResource = resourceId ? state.resources[resourceId] : undefined
  return {
    ...state,
    formulaOverrides: Object.keys(values).length ? values : undefined,
    ...(resettingResource && currentResource
      ? { resources: { ...state.resources, [resourceId]: { ...currentResource, maximum: undefined } } }
      : {}),
  }
}
