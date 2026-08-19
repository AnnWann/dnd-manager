import type { SessionAbilityOperation, SessionAbilityState } from "./abilitySessionProtocol"
import type {
  SessionConditionsState,
  SessionHpLogRecord,
  SessionHpState,
} from "./sessionProtocol"

export type SessionAbilityReverseOperation = {
  type: "character.ability.restore"
  characterId: string
  snapshot: {
    ability: SessionAbilityState
    hp: SessionHpState
    conditions: SessionConditionsState
  }
}

export type SessionAbilityLogRecord = {
  id: string
  actorId: string
  createdAt: string
  operation:
    | SessionAbilityOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation: SessionAbilityReverseOperation
  undoneAt?: string
  undoneBy?: string
}

/**
 * One chronological session timeline. The old name `hpLog` is kept in the
 * runtime transport for compatibility while domains are migrated, but records
 * may now belong to any authoritative sheet domain.
 */
export type SessionLogRecord = SessionHpLogRecord | SessionAbilityLogRecord

export function isAbilityLogRecord(
  record: SessionLogRecord,
): record is SessionAbilityLogRecord {
  return record.reverseOperation.type === "character.ability.restore"
}
