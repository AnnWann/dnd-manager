import type { SessionReadyMessage as SharedSessionReadyMessage, SessionHeartbeatAckMessage as SharedSessionHeartbeatAckMessage, SessionPresenceMessage as SharedSessionPresenceMessage, SessionHpSnapshotMessage as SharedSessionHpSnapshotMessage, SessionHpUpdatedMessage as SharedSessionHpUpdatedMessage, SessionConditionsSnapshotMessage as SharedSessionConditionsSnapshotMessage, SessionConditionsUpdatedMessage as SharedSessionConditionsUpdatedMessage, SessionHpLogMessage as SharedSessionHpLogMessage, SessionPongMessage as SharedSessionPongMessage, SessionErrorMessage as SharedSessionErrorMessage, SessionCustomSystemNoticeMessage as SharedSessionCustomSystemNoticeMessage, CharacterSheetRoute as SharedCharacterSheetRoute } from "../../../packages/session-protocol/src/sessionMessages"
import type { SessionActionRollRequest, SessionActionRollResult, SessionCreatureRollRequest, SessionDiceRollRequest, SessionDiceRollResult } from "../../shared/session-runtime/diceRollProtocol"
import type { SessionRuntimeRole, SessionRuntimePresenceUser, SessionDieSides, SessionHitDicePool, SessionHitDiceState, SessionAttribute, SessionAttributesState, SessionSavingThrowsState, SessionSkill, SessionSkillProficiency, SessionSkillsState, SessionStatsState, SessionConditionDuration, SessionCondition, SessionConditionsState, SessionConditionSeed, SessionHpState, SessionHpSeed, SessionHpOperation, SessionHitDiceOperation, SessionCalculatedStatOperation, SessionSimpleStatOperation, SessionStatOperation, SessionAttributeOperation, SessionSavingThrowOperation, SessionSkillOperation, SessionConditionOperation, SessionConcentrationOperation, SessionLongRestSupplySelection, SessionRestOperation, SessionAuthoritativeOperation, SessionLoggedOperation, SessionHpLogRecord } from "../../../packages/session-protocol/src/sessionCore"
export type { SessionRuntimeRole, SessionRuntimePresenceUser, SessionDieSides, SessionHitDicePool, SessionHitDiceState, SessionAttribute, SessionAttributesState, SessionSavingThrowsState, SessionSkill, SessionSkillProficiency, SessionSkillsState, SessionStatsState, SessionConditionDuration, SessionCondition, SessionConditionsState, SessionConditionSeed, SessionHpState, SessionHpSeed, SessionHpOperation, SessionHitDiceOperation, SessionCalculatedStatOperation, SessionSimpleStatOperation, SessionStatOperation, SessionAttributeOperation, SessionSavingThrowOperation, SessionSkillOperation, SessionConditionOperation, SessionConcentrationOperation, SessionLongRestSupplySelection, SessionRestOperation, SessionAuthoritativeOperation, SessionLoggedOperation, SessionHpLogRecord } from "../../../packages/session-protocol/src/sessionCore"

import type { SessionDiceResultMessage as SharedDiceResultMessage, SessionActionResultMessage as SharedActionResultMessage, ServerSessionMessage as SharedServerMessage, ClientSessionMessage as SharedClientMessage } from "../../../packages/session-protocol/src/sessionMessages"
export type SessionReadyMessage = SharedSessionReadyMessage
export type SessionHeartbeatAckMessage = SharedSessionHeartbeatAckMessage
export type SessionPresenceMessage = SharedSessionPresenceMessage
export type SessionHpSnapshotMessage = SharedSessionHpSnapshotMessage
export type SessionHpUpdatedMessage = SharedSessionHpUpdatedMessage
export type SessionConditionsSnapshotMessage = SharedSessionConditionsSnapshotMessage
export type SessionConditionsUpdatedMessage = SharedSessionConditionsUpdatedMessage
export type SessionHpLogMessage = SharedSessionHpLogMessage
export type SessionPongMessage = SharedSessionPongMessage
export type SessionDiceResultMessage = SharedDiceResultMessage<SessionDiceRollResult>
export type SessionActionResultMessage = SharedActionResultMessage<SessionActionRollResult>
export type SessionErrorMessage = SharedSessionErrorMessage
export type SessionCustomSystemNoticeMessage = SharedSessionCustomSystemNoticeMessage
export type ServerSessionMessage = SharedServerMessage<SessionDiceRollResult, SessionActionRollResult>
export type CharacterSheetRoute = SharedCharacterSheetRoute
export type ClientSessionMessage = SharedClientMessage<SessionDiceRollRequest, SessionActionRollRequest, SessionCreatureRollRequest>

export function parseServerSessionMessage(raw: string): ServerSessionMessage | null {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null
  const message = parsed as Record<string, unknown>
  switch (message.type) {
    case "session.ready":
      if (typeof message.sessionId === "string" && typeof message.clientId === "string" && typeof message.serverTime === "number") return message as SessionReadyMessage
      break
    case "session.heartbeat.ack":
    case "session.pong":
      if (typeof message.serverTime === "number") return message as SessionHeartbeatAckMessage | SessionPongMessage
      break
    case "session.presence": if (Array.isArray(message.users)) return message as SessionPresenceMessage; break
    case "session.hp.snapshot": if (Array.isArray(message.characters)) return message as SessionHpSnapshotMessage; break
    case "session.hp.updated": if (message.character && typeof message.character === "object") return message as SessionHpUpdatedMessage; break
    case "session.conditions.snapshot": if (Array.isArray(message.characters)) return message as SessionConditionsSnapshotMessage; break
    case "session.conditions.updated": if (message.character && typeof message.character === "object") return message as SessionConditionsUpdatedMessage; break
    case "session.hp.log": if (Array.isArray(message.records)) return message as SessionHpLogMessage; break
    case "session.dice.result": if (message.result && typeof message.result === "object") return message as SessionDiceResultMessage; break
    case "session.action.result": if (message.result && typeof message.result === "object") return message as SessionActionResultMessage; break
    case "session.customSystem.notice": if (typeof message.characterId === "string" && typeof message.title === "string" && typeof message.message === "string") return message as SessionCustomSystemNoticeMessage; break
    case "session.error": if (typeof message.code === "string" && typeof message.message === "string") return message as SessionErrorMessage; break
  }
  return null
}
