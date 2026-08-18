export type SessionRuntimeRole = "MASTER" | "PLAYER"

export type SessionRuntimePresenceUser = {
  userId: string
  clientId: string
  role: SessionRuntimeRole
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
  | SessionPongMessage
  | SessionErrorMessage

export type SessionHeartbeatMessage = {
  type: "session.heartbeat"
  clientId: string
}

export function parseServerSessionMessage(raw: string): ServerSessionMessage | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    return null
  }

  const message = parsed as Record<string, unknown>

  switch (message.type) {
    case "session.ready":
      if (
        typeof message.sessionId === "string" &&
        typeof message.clientId === "string" &&
        typeof message.serverTime === "number"
      ) {
        return message as SessionReadyMessage
      }
      break

    case "session.heartbeat.ack":
    case "session.pong":
      if (typeof message.serverTime === "number") {
        return message as SessionHeartbeatAckMessage | SessionPongMessage
      }
      break

    case "session.presence":
      if (Array.isArray(message.users)) {
        return message as SessionPresenceMessage
      }
      break

    case "session.error":
      if (typeof message.code === "string" && typeof message.message === "string") {
        return message as SessionErrorMessage
      }
      break
  }

  return null
}
