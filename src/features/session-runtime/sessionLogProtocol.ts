import type { SessionAbilityOperation, SessionAbilityState } from "./abilitySessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionInventoryOperation, SessionSharedInventoryState } from "./inventorySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionProfileOperation } from "./profileSessionProtocol"
import type { SessionProficiencyOperation } from "./proficiencySessionProtocol"
import type { SessionRaceOperation } from "./raceSessionProtocol"
import type {
  SessionConditionsState,
  SessionHpLogRecord,
  SessionHpState,
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
    | SessionRaceOperation
    | SessionProfileOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation:
    | SessionAbilityReverseOperation
    | SessionInventoryReverseOperation
    | SessionProficiencyReverseOperation
    | SessionRaceReverseOperation
    | SessionProfileReverseOperation
  undoneAt?: string
  undoneBy?: string
}

/** One chronological session timeline. `hpLog` remains only as a transport name. */
export type SessionLogRecord = SessionHpLogRecord | SessionRuntimeLogRecord

export function isAbilityLogRecord(record: SessionLogRecord): record is SessionRuntimeLogRecord {
  return record.reverseOperation.type === "character.ability.restore"
    || record.reverseOperation.type === "session.inventory.restore"
    || record.reverseOperation.type === "session.proficiency.restore"
    || record.reverseOperation.type === "session.race.restore"
    || record.reverseOperation.type === "session.profile.restore"
}

export function sessionLogScopes(record: SessionLogRecord): string[] {
  const reverse = record.reverseOperation as { characterId: string; affectedScopes?: string[] }
  if (reverse.affectedScopes?.length) return [...new Set(reverse.affectedScopes)]

  const scopes = [`character:${reverse.characterId}`]
  const operation = record.operation as SessionLogRecord["operation"] & {
    request?: {
      from?: { type?: string; characterId?: string }
      to?: { type?: string; characterId?: string }
    }
  }

  if (
    operation.type.startsWith("party.")
    || operation.type.startsWith("ground.")
    || operation.type === "character.equipment.move.ground"
  ) {
    scopes.push("inventory:shared")
  }

  if (operation.type === "inventory.item.transfer") {
    for (const location of [operation.request?.from, operation.request?.to]) {
      if (location?.type === "character" && location.characterId) {
        scopes.push(`character:${location.characterId}`)
      } else if (location?.type === "party" || location?.type === "ground") {
        scopes.push("inventory:shared")
      }
    }
  }

  return [...new Set(scopes)]
}

export function isLatestUndoableSessionLog(
  records: SessionLogRecord[],
  target: SessionLogRecord,
): boolean {
  if (target.undoneAt || target.operation.type === "character.hp.undo") return false
  const targetIndex = records.findIndex((record) => record.id === target.id)
  if (targetIndex < 0) return false
  const scopes = new Set(sessionLogScopes(target))

  return !records.slice(targetIndex + 1).some((record) => {
    if (record.undoneAt || record.operation.type === "character.hp.undo") return false
    return sessionLogScopes(record).some((scope) => scopes.has(scope))
  })
}
