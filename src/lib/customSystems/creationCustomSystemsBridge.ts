import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"

let overrideDefinitions: CustomSystemDefinition[] | null = null
const listeners = new Set<() => void>()

export function setCreationCustomSystemOverride(
  definitions: CustomSystemDefinition[] | null,
): void {
  overrideDefinitions = definitions ? structuredClone(definitions) : null
  for (const listener of listeners) listener()
}

export function getCreationCustomSystemOverride(): CustomSystemDefinition[] | null {
  return overrideDefinitions
}

export function subscribeCreationCustomSystemOverride(
  listener: () => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
