import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import type { CreationCharacterCustomSystemConfiguration } from "../../shared/creation/creation.types"
import { createCharacterCustomSystemState } from "./CustomSystemState"

export const CUSTOM_SYSTEM_SUPPRESSED_FIELD = "__customSystemSuppressed"

export function isSuppressedConfiguredCustomSystemState(
  state: CharacterCustomSystemState,
): boolean {
  return state.enabled === false && state.fields?.[CUSTOM_SYSTEM_SUPPRESSED_FIELD] === true
}

export function reconcileConfiguredCustomSystemStates(
  currentStates: CharacterCustomSystemState[],
  configuredSystems: CreationCharacterCustomSystemConfiguration[],
  definitions: CustomSystemDefinition[],
): CharacterCustomSystemState[] {
  const currentById = new Map(
    currentStates.map((state) => [state.systemId, state]),
  )
  const definitionById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  )

  return configuredSystems.flatMap((configured) => {
    const definition = definitionById.get(configured.systemId)
    if (!definition || definition.version !== configured.systemVersion) return []

    if (configured.suppressed) {
      return [createSuppressedState(configured)]
    }

    const current = currentById.get(configured.systemId)
    const base = isCompatibleRuntimeState(current, configured)
      ? current
      : createCharacterCustomSystemState(definition)

    return [{
      ...base,
      systemId: configured.systemId,
      systemVersion: configured.systemVersion,
      enabled: configured.enabled,
      abilityAcquisitionExceptions: configured.abilityAcquisitionExceptions,
      installationSource: configured.installationSource,
    }]
  })
}

function createSuppressedState(
  configured: CreationCharacterCustomSystemConfiguration,
): CharacterCustomSystemState {
  return {
    systemId: configured.systemId,
    systemVersion: configured.systemVersion,
    enabled: false,
    fields: { [CUSTOM_SYSTEM_SUPPRESSED_FIELD]: true },
    resources: {},
    abilities: [],
    installationSource: configured.installationSource,
  }
}

function isCompatibleRuntimeState(
  state: CharacterCustomSystemState | undefined,
  configured: CreationCharacterCustomSystemConfiguration,
): state is CharacterCustomSystemState {
  return Boolean(
    state
    && !isSuppressedConfiguredCustomSystemState(state)
    && state.systemVersion === configured.systemVersion
    && state.fields
    && typeof state.fields === "object"
    && !Array.isArray(state.fields)
    && state.resources
    && typeof state.resources === "object"
    && !Array.isArray(state.resources)
    && Array.isArray(state.abilities),
  )
}
