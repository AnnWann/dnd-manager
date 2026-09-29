import type { CustomSystemDefinition } from "../../models/customSystems/CustomSystemDefinition"

let runtimeOverrideDefinitions: CustomSystemDefinition[] | null = null
let editorOverrideDefinitions: CustomSystemDefinition[] | null = null
let snapshot: CustomSystemDefinition[] | null = null
const listeners = new Set<() => void>()

function cloneDefinitions(
  definitions: CustomSystemDefinition[] | null,
): CustomSystemDefinition[] | null {
  return definitions ? structuredClone(definitions) : null
}

function rebuildSnapshot(): void {
  // While the Creation editor is mounted, its draft is the authoritative
  // source for previews and formula resolution. Runtime websocket snapshots
  // can arrive at any time and must never clobber an unsaved/newer draft.
  snapshot = cloneDefinitions(
    editorOverrideDefinitions ?? runtimeOverrideDefinitions,
  )
  for (const listener of listeners) listener()
}

/**
 * Definitions published by the authoritative session runtime.
 */
export function setRuntimeCustomSystemOverride(
  definitions: CustomSystemDefinition[] | null,
): void {
  runtimeOverrideDefinitions = cloneDefinitions(definitions)
  rebuildSnapshot()
}

/**
 * Definitions from the currently mounted Creation editor draft.
 * This source has priority over runtime snapshots until the editor unmounts.
 */
export function setCreationEditorCustomSystemOverride(
  definitions: CustomSystemDefinition[] | null,
): void {
  editorOverrideDefinitions = cloneDefinitions(definitions)
  rebuildSnapshot()
}

export function getCreationCustomSystemOverride(): CustomSystemDefinition[] | null {
  return snapshot
}

export function subscribeCreationCustomSystemOverride(
  listener: () => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
