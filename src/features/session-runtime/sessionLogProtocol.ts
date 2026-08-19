import type { SessionAbilityOperation, SessionAbilityState } from "./abilitySessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionInventoryOperation, SessionSharedInventoryState } from "./inventorySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionProficiencyOperation } from "./proficiencySessionProtocol"
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

export type SessionInventoryReverseOperation = {
  type: "session.inventory.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    abilities: Record<string, SessionAbilityState>
    hp: Record<string, SessionHpState>
    conditions: Record<string, SessionConditionsState>
    inventory: SessionSharedInventoryState
  }
}

export type SessionProficiencyReverseOperation = {
  type: "session.proficiency.restore"
  characterId: string
  snapshot: SessionAbilityState
}

export type SessionRuntimeLogRecord = {
  id: string
  actorId: string
  createdAt: string
  operation:
    | SessionAbilityOperation
    | SessionMagicOperation
    | SessionEquipmentOperation
    | SessionInventoryOperation
    | SessionProficiencyOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation:
    | SessionAbilityReverseOperation
    | SessionInventoryReverseOperation
    | SessionProficiencyReverseOperation
  undoneAt?: string
  undoneBy?: string
}

/** One chronological session timeline. `hpLog` remains only as a transport name. */
export type SessionLogRecord = SessionHpLogRecord | SessionRuntimeLogRecord

export function isAbilityLogRecord(record: SessionLogRecord): record is SessionRuntimeLogRecord {
  return record.reverseOperation.type === "character.ability.restore"
    || record.reverseOperation.type === "session.inventory.restore"
    || record.reverseOperation.type === "session.proficiency.restore"
}
