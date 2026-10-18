import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import type { CreationCharacterCustomSystemConfiguration } from "../../shared/creation/creation.types"
import { createCharacterCustomSystemState } from "./CustomSystemState.js"

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
    if (!definition) return []

    const latestConfiguration = {
      ...configured,
      systemVersion: definition.version,
    }

    if (configured.suppressed) {
      return [createSuppressedState(latestConfiguration)]
    }

    const current = currentById.get(configured.systemId)
    const base =
      current && !isSuppressedConfiguredCustomSystemState(current)
        ? migrateRuntimeState(current, definition)
        : createCharacterCustomSystemState(definition)

    return [{
      ...base,
      systemId: configured.systemId,
      systemVersion: definition.version,
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

function migrateRuntimeState(
  state: CharacterCustomSystemState,
  definition: CustomSystemDefinition,
): CharacterCustomSystemState {
  const fresh = createCharacterCustomSystemState(definition)
  const fieldIds = new Set(definition.fields.map((field) => field.id))
  const resourceIds = new Set(
    definition.resources.map((resource) => resource.id),
  )
  const abilityTypeIds = new Set(
    definition.abilityTypes.map((abilityType) => abilityType.id),
  )

  return {
    ...fresh,
    enabled: state.enabled,
    fields: {
      ...fresh.fields,
      ...Object.fromEntries(
        Object.entries(state.fields ?? {}).filter(([fieldId]) =>
          fieldIds.has(fieldId),
        ),
      ),
    },
    resources: {
      ...fresh.resources,
      ...Object.fromEntries(
        Object.entries(state.resources ?? {}).filter(([resourceId]) =>
          resourceIds.has(resourceId),
        ),
      ),
    },
    abilities: Array.isArray(state.abilities)
      ? state.abilities.filter((ability) =>
          abilityTypeIds.has(ability.abilityTypeId),
        )
      : [],
    abilityAcquisitionExceptions: state.abilityAcquisitionExceptions,
    installationSource: state.installationSource,
  }
}
