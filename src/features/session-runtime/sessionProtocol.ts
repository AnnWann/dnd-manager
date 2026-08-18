export type SessionRuntimeRole = "MASTER" | "PLAYER"

export type SessionRuntimePresenceUser = {
  userId: string
  clientId: string
  role: SessionRuntimeRole
}

export type SessionHpState = {
  characterId: string
  ownerUserId?: string
  current: number
  temporary: number
  max: number
  currentMax: number
  maxHpBonus: number
  revision: number
}

export type SessionHpSeed = Omit<SessionHpState, "revision">

export type SessionHpOperation =
  | { type: "character.hp.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.add"; characterId: string; amount: number }
  | {
      type: "character.hp.damage"
      characterId: string
      amount: number
      requiresConcentrationCheck?: boolean
      concentrationDc?: number
      concentrationSource?: string
    }
  | { type: "character.hp.heal"; characterId: string; amount: number }
  | { type: "character.hp.max.set"; characterId: string; value: number }
  | { type: "character.hp.currentMax.adjust"; characterId: string; amount: number }
  | { type: "character.hp.currentMax.restore"; characterId: string }

export type SessionHpLogRecord = {
  id: string
  actorId: string
  createdAt: string
  operation: SessionHpOperation | { type: "character.hp.undo"; characterId: string; sourceLogId: string }
  reverseOperation: {
    type: "character.hp.restore"
    characterId: string
    hp: SessionHpState
  }
  undoneAt?: string
  undoneBy?: string
}

export type SessionReadyMessage = {
  type: "session.ready"
  sessionId: string
  clientId: string
  serverTime: number
}

export type SessionHeartbeatAckMessage = {
  type: "session.heartbeat.ack"
  serverTime: number
}

export type SessionPresenceMessage = {
  type: "session.presence"
  users: SessionRuntimePresenceUser[]
}

export type SessionHpSnapshotMessage = {
  type: "session.hp.snapshot"
  characters: SessionHpState[]
}

export type SessionHpUpdatedMessage = {
  type: "session.hp.updated"
  character: SessionHpState
}

export type SessionHpLogMessage = {
  type: "session.hp.log"
  records: SessionHpLogRecord[]
}

export type SessionPongMessage = {
  type: "session.pong"
  serverTime: number
}

export type SessionErrorMessage = {
  type: "session.error"
  code: string
  message: string
}

export type ServerSessionMessage =
  | SessionReadyMessage
  | SessionHeartbeatAckMessage
  | SessionPresenceMessage
  | SessionHpSnapshotMessage
  | SessionHpUpdatedMessage
  | SessionHpLogMessage
  | SessionPongMessage
  | SessionErrorMessage

export type ClientSessionMessage =
  | { type: "session.heartbeat"; clientId: string }
  | { type: "session.ping" }
  | { type: "session.hp.initialize"; characters: SessionHpSeed[] }
  | { type: "session.hp.operation"; operation: SessionHpOperation }
  | { type: "session.log.undo"; logId: string }

export function parseServerSessionMessage(raw: string): ServerSessionMessage | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null
  const message = parsed as Record<string, unknown>

  switch (message.type) {
    case "session.ready":
      if (
        typeof message.sessionId === "string" &&
        typeof message.clientId === "string" &&
        typeof message.serverTime === "number"
      ) return message as SessionReadyMessage
      break
    case "session.heartbeat.ack":
    case "session.pong":
      if (typeof message.serverTime === "number") {
        return message as SessionHeartbeatAckMessage | SessionPongMessage
      }
      break
    case "session.presence":
      if (Array.isArray(message.users)) return message as SessionPresenceMessage
      break
    case "session.hp.snapshot":
      if (Array.isArray(message.characters)) return message as SessionHpSnapshotMessage
      break
    case "session.hp.updated":
      if (message.character && typeof message.character === "object") {
        return message as SessionHpUpdatedMessage
      }
      break
    case "session.hp.log":
      if (Array.isArray(message.records)) return message as SessionHpLogMessage
      break
    case "session.error":
      if (typeof message.code === "string" && typeof message.message === "string") {
        return message as SessionErrorMessage
      }
      break
  }

  return null
}
