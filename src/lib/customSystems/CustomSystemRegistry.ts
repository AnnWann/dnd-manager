import { useSyncExternalStore } from 'react'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'
import './CharacterTemplateCustomSystemsPatch'

const definitions = new Map<string, CustomSystemDefinition>()
const listeners = new Set<() => void>()
let snapshot: CustomSystemDefinition[] = []

function emitChange(): void {
  snapshot = Array.from(definitions.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  )
  for (const listener of listeners) listener()
}

export function registerCustomSystemDefinition(
  definition: CustomSystemDefinition,
): () => void {
  definitions.set(definition.id, definition)
  emitChange()

  return () => {
    const current = definitions.get(definition.id)
    if (current === definition) {
      definitions.delete(definition.id)
      emitChange()
    }
  }
}

export function setCustomSystemDefinitions(
  nextDefinitions: CustomSystemDefinition[],
): void {
  definitions.clear()
  for (const definition of nextDefinitions) {
    definitions.set(definition.id, definition)
  }
  emitChange()
}

export function getCustomSystemDefinition(
  systemId: string,
): CustomSystemDefinition | undefined {
  return definitions.get(systemId)
}

export function getCustomSystemDefinitions(): CustomSystemDefinition[] {
  return snapshot
}

export function useCustomSystemDefinitions(): CustomSystemDefinition[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getCustomSystemDefinitions,
    getCustomSystemDefinitions,
  )
}
