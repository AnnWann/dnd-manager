import type { InitiativeEntry } from "../../models/initiative/Initiative"

export type InitiativeRosterProps = {
  entries: InitiativeEntry[]
  activeEntryId?: string
  roundAnchorEntryId?: string
  round: number
  started: boolean
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
  onOpen: (entryId: string) => void
  onCondition: (entryId: string) => void
  onRemove: (entryId: string) => void
  onTrade: (entryId: string, direction: -1 | 1) => void
  canTrade: (entryId: string, direction: -1 | 1) => boolean
  onRemoveCondition: (entryId: string, conditionId: string) => void
}
