import { useSyncExternalStore } from 'react'
import type { CustomAbilityTypeDefinition } from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type { CustomResourceDefinition } from '../../models/customSystems/CustomResourceDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import './CharacterTemplateCustomSystemsPatch'
import {
  getCreationCustomSystemOverride,
  subscribeCreationCustomSystemOverride,
} from './creationCustomSystemsBridge'
import { configureCustomFormulaRuntime } from './CustomFormulaRuntimePatch'
import { configureCustomNativeStatOverrides } from './CustomNativeStatOverrides'

const definitions = new Map<string, CustomSystemDefinition>()
const listeners = new Set<() => void>()
let snapshot: CustomSystemDefinition[] = []

configureCustomFormulaRuntime(getCustomSystemDefinition)
configureCustomNativeStatOverrides(getCustomSystemDefinition)

function emitChange(): void {
  snapshot = Array.from(definitions.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  )
  for (const listener of listeners) listener()
}

export function registerCustomSystemDefinition(
  definition: CustomSystemDefinition,
): () => void {
  const normalized = withMasterOverride(definition)
  definitions.set(normalized.id, normalized)
  emitChange()

  return () => {
    const current = definitions.get(normalized.id)
    if (current === normalized) {
      definitions.delete(normalized.id)
      emitChange()
    }
  }
}

export function setCustomSystemDefinitions(
  nextDefinitions: CustomSystemDefinition[],
): void {
  definitions.clear()
  for (const definition of nextDefinitions) {
    const normalized = withMasterOverride(definition)
    definitions.set(normalized.id, normalized)
  }
  emitChange()
}

export function getCustomSystemDefinition(
  systemId: string,
): CustomSystemDefinition | undefined {
  const creationDefinitions = getCreationCustomSystemOverride()
  if (creationDefinitions) {
    return creationDefinitions.find((definition) => definition.id === systemId)
  }
  return definitions.get(systemId)
}

export function getCustomSystemDefinitions(): CustomSystemDefinition[] {
  return snapshot
}

export function useCustomSystemDefinitions(): CustomSystemDefinition[] {
  const runtimeDefinitions = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getCustomSystemDefinitions,
    getCustomSystemDefinitions,
  )
  const creationDefinitions = useSyncExternalStore(
    subscribeCreationCustomSystemOverride,
    getCreationCustomSystemOverride,
    getCreationCustomSystemOverride,
  )

  return creationDefinitions ?? runtimeDefinitions
}

/**
 * The DM is the campaign authority and must be able to correct character data.
 *
 * The domain actor still uses `master`, so owner-only definitions are exposed to
 * the character editor as owner-and-master. `automaticOnly` remains protected.
 * The persisted definition is not mutated; this is only the runtime definition
 * consumed by character sheets.
 */
function withMasterOverride(
  definition: CustomSystemDefinition,
): CustomSystemDefinition {
  return {
    ...definition,
    fields: definition.fields.map(withFieldMasterOverride),
    resources: definition.resources.map(withResourceMasterOverride),
    abilityTypes: definition.abilityTypes.map(withAbilityTypeMasterOverride),
  }
}

function withFieldMasterOverride(
  field: CustomFieldDefinition,
): CustomFieldDefinition {
  if (field.editPermission !== 'owner') return field
  return {
    ...field,
    editPermission: 'ownerAndMaster',
  }
}

function withResourceMasterOverride(
  resource: CustomResourceDefinition,
): CustomResourceDefinition {
  if (resource.editPermission !== 'owner') return resource
  return {
    ...resource,
    editPermission: 'ownerAndMaster',
  }
}

function withAbilityTypeMasterOverride(
  abilityType: CustomAbilityTypeDefinition,
): CustomAbilityTypeDefinition {
  const fields = abilityType.fields.map(withFieldMasterOverride)
  const configuredTitleFieldId = abilityType.display.titleFieldId?.trim()
  const titleFieldId =
    configuredTitleFieldId || inferAbilityTitleFieldId(fields) || ''

  return {
    ...abilityType,
    fields,
    display: {
      ...abilityType.display,
      titleFieldId,
    },
  }
}

function inferAbilityTitleFieldId(
  fields: CustomFieldDefinition[],
): string | undefined {
  const titleNames = new Set(['nome', 'name', 'titulo', 'title'])

  return (
    fields.find((field) => titleNames.has(normalizeFieldName(field.id))) ??
    fields.find((field) => titleNames.has(normalizeFieldName(field.name)))
  )?.id
}

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}
