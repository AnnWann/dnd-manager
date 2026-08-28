import type { InitiativeSession } from "../../models/initiative/Initiative"

export type SessionInitiativeState = {
  initialized: boolean
  revision: number
  session: InitiativeSession
}

export type SessionInitiativeOperation =
  | { type: "initiative.entries.add"; characterId: "session"; entries: Record<string, unknown>[] }
  | { type: "initiative.entry.update"; characterId: "session"; entryId: string; patch: Record<string, unknown> }
  | { type: "initiative.entry.remove"; characterId: "session"; entryId: string }
  | { type: "initiative.sort"; characterId: "session" }
  | { type: "initiative.combat.start"; characterId: "session" }
  | { type: "initiative.combat.end"; characterId: "session" }
  | { type: "initiative.turn.next"; characterId: "session" }
  | { type: "initiative.turn.previous"; characterId: "session" }
  | { type: "initiative.allies.trade"; characterId: "session"; entryId: string; direction: 1 }
  | { type: "initiative.viewMode.set"; characterId: "session"; viewMode: "table" | "cards" }
  | { type: "initiative.settings.update"; characterId: "session"; patch: { deathSaveVisibility?: "masterOnly" | "owner" | "everyone"; deathSaveOwnerCanEdit?: boolean } }
  | { type: "initiative.deathSaves.set"; characterId: "session"; entryId: string; successes: number; failures: number }
  | { type: "initiative.reset"; characterId: "session" }

export type SessionInitiativeClientMessage =
  | { type: "session.initiative.initialize"; session: InitiativeSession }
  | { type: "session.initiative.operation"; operation: SessionInitiativeOperation }

export type SessionInitiativeServerMessage =
  | { type: "session.initiative.snapshot"; state: SessionInitiativeState }
  | { type: "session.initiative.updated"; state: SessionInitiativeState }

export function parseInitiativeServerMessage(raw: string): SessionInitiativeServerMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value?.type !== "session.initiative.snapshot" && value?.type !== "session.initiative.updated") return null
    if (!value.state || typeof value.state !== "object") return null
    return value as SessionInitiativeServerMessage
  } catch {
    return null
  }
}
