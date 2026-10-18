import type { InitiativeSession } from "../../models/initiative/Initiative"
import type { DamageType } from "../../models/combat/Damage"

export type SessionInitiativeState = {
  initialized: boolean
  revision: number
  session: InitiativeSession
}

import type { InitiativeDamagePart as SharedDamagePart, SessionInitiativeOperation as SharedInitiativeOperation } from "../../../../../packages/session-protocol/src/initiativeOperations"
import type { InitiativeHpApplicationResult } from "../../../../../packages/session-protocol/src/initiativeHp"
export type { InitiativeHpApplicationResult } from "../../../../../packages/session-protocol/src/initiativeHp"
export type InitiativeDamagePart = SharedDamagePart<DamageType>
export type SessionInitiativeOperation = SharedInitiativeOperation<DamageType>

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
