import type { SessionRuntimePresenceUser, SessionHpState, SessionConditionsState, SessionHpLogRecord, SessionHpSeed, SessionAuthoritativeOperation, SessionConditionSeed, SessionConditionOperation, SessionConcentrationOperation, SessionLoggedOperation } from "./sessionCore.ts"

export type SessionReadyMessage = { type: "session.ready"; sessionId: string; clientId: string; serverTime: number }
export type SessionHeartbeatAckMessage = { type: "session.heartbeat.ack"; serverTime: number }
export type SessionPresenceMessage = { type: "session.presence"; users: SessionRuntimePresenceUser[] }
export type SessionHpSnapshotMessage = { type: "session.hp.snapshot"; characters: SessionHpState[] }
export type SessionHpUpdatedMessage = { type: "session.hp.updated"; character: SessionHpState }
export type SessionConditionsSnapshotMessage = { type: "session.conditions.snapshot"; characters: SessionConditionsState[] }
export type SessionConditionsUpdatedMessage = { type: "session.conditions.updated"; character: SessionConditionsState }
export type SessionHpLogMessage = { type: "session.hp.log"; records: SessionHpLogRecord[] }
export type SessionPongMessage = { type: "session.pong"; serverTime: number }
export type SessionDiceResultMessage<TDiceResult> = { type: "session.dice.result"; result: TDiceResult }
export type SessionActionResultMessage<TActionResult> = { type: "session.action.result"; result: TActionResult }
export type SessionErrorMessage = { type: "session.error"; code: string; message: string }
export type SessionCustomSystemNoticeMessage = { type: "session.customSystem.notice"; characterId: string; title: string; message: string }

export type ServerSessionMessage<TDiceResult, TActionResult> =
  | SessionReadyMessage | SessionHeartbeatAckMessage | SessionPresenceMessage
  | SessionHpSnapshotMessage | SessionHpUpdatedMessage
  | SessionConditionsSnapshotMessage | SessionConditionsUpdatedMessage
  | SessionHpLogMessage | SessionPongMessage | SessionDiceResultMessage<TDiceResult> | SessionActionResultMessage<TActionResult> | SessionCustomSystemNoticeMessage | SessionErrorMessage

export type CharacterSheetRoute =
  | "characters/sheet/hp"
  | "characters/sheet/hitdice"
  | "characters/sheet/stats/armor-class"
  | "characters/sheet/stats/initiative"
  | "characters/sheet/stats/mobility"
  | "characters/sheet/stats/passive-perception"
  | "characters/sheet/stats/exhaustion"
  | "characters/sheet/stats/inspiration"
  | "characters/sheet/stats/experience"
  | "characters/sheet/attributes"
  | "characters/sheet/saving-throws"
  | "characters/sheet/skills"
  | "characters/sheet/conditions"
  | "characters/sheet/concentration"
  | "characters/sheet/rest"

export type ClientSessionMessage<TDiceRequest, TActionRequest, TCreatureRequest> =
  | { type: "session.heartbeat"; clientId: string }
  | { type: "session.ping" }
  | { type: "session.hp.initialize"; characters: SessionHpSeed[] }
  | { type: "session.hp.operation"; operation: SessionAuthoritativeOperation }
  | { type: "session.conditions.initialize"; characters: SessionConditionSeed[] }
  | { type: "session.conditions.operation"; operation: SessionConditionOperation | SessionConcentrationOperation }
  | { type: "session.sheet.operation"; route: CharacterSheetRoute; operation: SessionLoggedOperation }
  | { type: "session.log.undo"; logId: string }
  | { type: "session.dice.roll"; request: TDiceRequest }
  | { type: "session.action.roll"; request: TActionRequest }
  | { type: "session.creature.roll"; request: TCreatureRequest }

