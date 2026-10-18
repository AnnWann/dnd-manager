import type { SessionAbilityOperation, SessionAbilityState } from "./abilitySessionProtocol"
import type {
  SessionCharacterLifecycleOperation,
  SessionCharacterLifecycleState,
} from "./characterLifecycleSessionProtocol"
import type { SessionCustomSystemOperation } from "./customSystemSessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionInitiativeOperation, SessionInitiativeState } from "./initiativeSessionProtocol"
import type { SessionInventoryOperation, SessionSharedInventoryState } from "./inventorySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionMissionOperation, SessionMissionState } from "./missionSessionProtocol"
import type { SessionProfileOperation } from "./profileSessionProtocol"
import type { SessionProficiencyOperation } from "./proficiencySessionProtocol"
import type { SessionRaceOperation } from "./raceSessionProtocol"
import type {
  SessionConditionsState,
  SessionHpLogRecord,
  SessionHpState,
  SessionRestOperation,
} from "./sessionProtocol"

export type SessionAbilityReverseOperation = {
  type: "character.ability.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    ability: SessionAbilityState
    hp: SessionHpState
    conditions: SessionConditionsState
  }
}

export type SessionRestReverseOperation = {
  type: "session.rest.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    ability: SessionAbilityState
    hp: SessionHpState
    conditions: SessionConditionsState
    inventory?: SessionSharedInventoryState
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

export type SessionMissionReverseOperation = {
  type: "session.missions.restore"
  characterId: "session"
  affectedScopes?: string[]
  snapshot: SessionMissionState
}

export type SessionInitiativeReverseOperation = {
  type: "session.initiative.restore"
  characterId: "session"
  affectedScopes?: string[]
  snapshot: SessionInitiativeState
  /** Character runtime snapshots changed by initiative-triggered automations. */
  abilities?: Record<string, SessionAbilityState>
}

export type SessionProficiencyReverseOperation = {
  type: "session.proficiency.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: SessionAbilityState
}

export type SessionRaceReverseOperation = {
  type: "session.race.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    ability: SessionAbilityState
    hp: SessionHpState
  }
}

export type SessionProfileReverseOperation = {
  type: "session.profile.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    ability: SessionAbilityState
    hp: SessionHpState
  }
}

export type SessionCharacterLifecycleReverseOperation = {
  type: "session.character.restore"
  characterId: string
  affectedScopes?: string[]
  snapshot: {
    lifecycle?: SessionCharacterLifecycleState
    ability?: SessionAbilityState
    hp?: SessionHpState
    conditions?: SessionConditionsState
  }
}

export type SessionRuntimeLogRecord = {
  id: string
  actorId: string
  actorName?: string
  createdAt: string
  operation:
    | SessionAbilityOperation
    | SessionMagicOperation
    | SessionEquipmentOperation
    | SessionInventoryOperation
    | SessionMissionOperation
    | SessionInitiativeOperation
    | SessionProficiencyOperation
    | SessionRaceOperation
    | SessionProfileOperation
    | SessionCharacterLifecycleOperation
    | SessionCustomSystemOperation
    | SessionRestOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation:
    | SessionAbilityReverseOperation
    | SessionRestReverseOperation
    | SessionInventoryReverseOperation
    | SessionMissionReverseOperation
    | SessionInitiativeReverseOperation
    | SessionProficiencyReverseOperation
    | SessionRaceReverseOperation
    | SessionProfileReverseOperation
    | SessionCharacterLifecycleReverseOperation
  undoneAt?: string
  undoneBy?: string
}

/** One chronological session timeline. `hpLog` remains only as a transport name. */
export type SessionLogRecord = SessionHpLogRecord | SessionRuntimeLogRecord

export function isAbilityLogRecord(record: SessionLogRecord): record is SessionRuntimeLogRecord {
  return record.reverseOperation.type === "character.ability.restore"
    || record.reverseOperation.type === "session.rest.restore"
    || record.reverseOperation.type === "session.inventory.restore"
    || record.reverseOperation.type === "session.missions.restore"
    || record.reverseOperation.type === "session.initiative.restore"
    || record.reverseOperation.type === "session.proficiency.restore"
    || record.reverseOperation.type === "session.race.restore"
    || record.reverseOperation.type === "session.profile.restore"
    || record.reverseOperation.type === "session.character.restore"
}

export { sessionLogScopes, isLatestUndoableSessionLog } from "../../../packages/session-protocol/src/sessionLog"
