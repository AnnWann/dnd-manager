import type { CustomSystemEditPermission } from '../../models/customSystems/CustomGenerals'
import type { CharacterCustomSystemState, CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import type { CustomSystemActor } from './CustomSystemState'

export function setCustomResourceMaximum(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  resourceId: string,
  maximum: number | undefined,
  actor: CustomSystemActor,
): CharacterCustomSystemState {
  const resource = definition.resources.find((entry) => entry.id === resourceId)
  if (!resource) throw new Error(`Recurso “${resourceId}” não encontrado.`)

  const mode = resource.maximumMode ?? (resource.maximumFormula ? 'formula' : 'fixed')
  if (mode !== 'manual' && mode !== 'formulaWithOverride') {
    throw new Error(`O máximo de “${resource.name}” não é editável por personagem.`)
  }

  assertPermission(resource.maximumEditPermission ?? 'masterOnly', actor)
  const currentState = state.resources[resourceId]
  if (!currentState) throw new Error(`O recurso “${resource.name}” não está instalado neste personagem.`)

  const normalized = maximum === undefined
    ? undefined
    : Math.max(resource.minimum ?? 0, Number.isFinite(maximum) ? maximum : 0)

  return {
    ...state,
    resources: {
      ...state.resources,
      [resourceId]: {
        ...currentState,
        maximum: normalized,
        current: normalized === undefined ? currentState.current : Math.min(currentState.current, normalized),
      },
    },
  }
}

export function canEditCustomResourceMaximum(
  definition: CustomSystemDefinition,
  resourceId: string,
  actor: CustomSystemActor,
): boolean {
  const resource = definition.resources.find((entry) => entry.id === resourceId)
  if (!resource) return false
  const mode = resource.maximumMode ?? (resource.maximumFormula ? 'formula' : 'fixed')
  if (mode !== 'manual' && mode !== 'formulaWithOverride') return false
  return permissionAllows(resource.maximumEditPermission ?? 'masterOnly', actor)
}

function assertPermission(permission: CustomSystemEditPermission, actor: CustomSystemActor) {
  if (!permissionAllows(permission, actor)) throw new Error('Você não possui permissão para alterar este máximo.')
}

function permissionAllows(permission: CustomSystemEditPermission, actor: CustomSystemActor) {
  if (permission === 'ownerAndMaster') return actor === 'owner' || actor === 'master'
  if (permission === 'owner') return actor === 'owner'
  if (permission === 'masterOnly') return actor === 'master'
  return actor === 'automation'
}
