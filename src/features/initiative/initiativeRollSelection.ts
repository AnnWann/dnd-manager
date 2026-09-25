import { useSyncExternalStore } from "react"

export type InitiativeRollSelection = {
  entryId: string
  name: string
}

let currentSelection: InitiativeRollSelection | undefined
const listeners = new Set<() => void>()

export function setInitiativeRollSelection(
  selection: InitiativeRollSelection | undefined,
): void {
  const same =
    currentSelection?.entryId === selection?.entryId
    && currentSelection?.name === selection?.name
  if (same) return

  currentSelection = selection
  for (const listener of listeners) listener()
}

export function getInitiativeRollSelection(): InitiativeRollSelection | undefined {
  return currentSelection
}

export function useInitiativeRollSelection(): InitiativeRollSelection | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getInitiativeRollSelection,
    () => undefined,
  )
}
