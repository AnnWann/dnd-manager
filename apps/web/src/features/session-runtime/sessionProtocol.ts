import { parseServerSessionMessage as parseSharedServerSessionMessage } from "../../../../../packages/session-protocol/src/sessionMessages"
import type { SessionReadyMessage as SharedSessionReadyMessage, SessionHeartbeatAckMessage as SharedSessionHeartbeatAckMessage, SessionPresenceMessage as SharedSessionPresenceMessage, SessionHpSnapshotMessage as SharedSessionHpSnapshotMessage, SessionHpUpdatedMessage as SharedSessionHpUpdatedMessage, SessionConditionsSnapshotMessage as SharedSessionConditionsSnapshotMessage, SessionConditionsUpdatedMessage as SharedSessionConditionsUpdatedMessage, SessionHpLogMessage as SharedSessionHpLogMessage, SessionPongMessage as SharedSessionPongMessage, SessionErrorMessage as SharedSessionErrorMessage, SessionCustomSystemNoticeMessage as SharedSessionCustomSystemNoticeMessage, CharacterSheetRoute as SharedCharacterSheetRoute } from "../../../../../packages/session-protocol/src/sessionMessages"
import type { SessionActionRollRequest, SessionActionRollResult, SessionCreatureRollRequest, SessionDiceRollRequest, SessionDiceRollResult } from "../../shared/session-runtime/diceRollProtocol"
import type { SessionRuntimeRole, SessionRuntimePresenceUser, SessionDieSides, SessionHitDicePool, SessionHitDiceState, SessionAttribute, SessionAttributesState, SessionSavingThrowsState, SessionSkill, SessionSkillProficiency, SessionSkillsState, SessionStatsState, SessionConditionDuration, SessionCondition, SessionConditionsState, SessionConditionSeed, SessionHpState, SessionHpSeed, SessionHpOperation, SessionHitDiceOperation, SessionCalculatedStatOperation, SessionSimpleStatOperation, SessionStatOperation, SessionAttributeOperation, SessionSavingThrowOperation, SessionSkillOperation, SessionConditionOperation, SessionConcentrationOperation, SessionLongRestSupplySelection, SessionRestOperation, SessionAuthoritativeOperation, SessionLoggedOperation, SessionHpLogRecord } from "../../../../../packages/session-protocol/src/sessionCore"
export type { SessionRuntimeRole, SessionRuntimePresenceUser, SessionDieSides, SessionHitDicePool, SessionHitDiceState, SessionAttribute, SessionAttributesState, SessionSavingThrowsState, SessionSkill, SessionSkillProficiency, SessionSkillsState, SessionStatsState, SessionConditionDuration, SessionCondition, SessionConditionsState, SessionConditionSeed, SessionHpState, SessionHpSeed, SessionHpOperation, SessionHitDiceOperation, SessionCalculatedStatOperation, SessionSimpleStatOperation, SessionStatOperation, SessionAttributeOperation, SessionSavingThrowOperation, SessionSkillOperation, SessionConditionOperation, SessionConcentrationOperation, SessionLongRestSupplySelection, SessionRestOperation, SessionAuthoritativeOperation, SessionLoggedOperation, SessionHpLogRecord } from "../../../../../packages/session-protocol/src/sessionCore"

import type { SessionDiceResultMessage as SharedDiceResultMessage, SessionActionResultMessage as SharedActionResultMessage, ServerSessionMessage as SharedServerMessage, ClientSessionMessage as SharedClientMessage } from "../../../../../packages/session-protocol/src/sessionMessages"
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
  return parseSharedServerSessionMessage<SessionDiceRollResult, SessionActionRollResult>(raw)
}
