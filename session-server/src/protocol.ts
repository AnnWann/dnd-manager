export type SessionRole = "MASTER" | "PLAYER";

export type SessionConnection = {
  sessionId: string;
  clientId: string;
  userId: string;
  role: SessionRole;
  connectedAt: number;
  lastHeartbeatAt: number;
};

export type SessionHeartbeatMessage = {
  type: "session.heartbeat";
  clientId: string;
};

export type SessionPingMessage = {
  type: "session.ping";
};

export type ClientSessionMessage =
  | SessionHeartbeatMessage
  | SessionPingMessage;

export type SessionReadyMessage = {
  type: "session.ready";
  sessionId: string;
  clientId: string;
  serverTime: number;
};

export type SessionHeartbeatAckMessage = {
  type: "session.heartbeat.ack";
  serverTime: number;
};

export type SessionPongMessage = {
  type: "session.pong";
  serverTime: number;
};

export type SessionPresenceUser = Pick<
  SessionConnection,
  "userId" | "clientId" | "role"
>;

export type SessionPresenceMessage = {
  type: "session.presence";
  users: SessionPresenceUser[];
};

export type SessionErrorMessage = {
  type: "session.error";
  code: string;
  message: string;
};

export type ServerSessionMessage =
  | SessionReadyMessage
  | SessionHeartbeatAckMessage
  | SessionPongMessage
  | SessionPresenceMessage
  | SessionErrorMessage;

export function parseClientSessionMessage(raw: string): ClientSessionMessage | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || !("type" in value)) {
    return null;
  }

  const message = value as Record<string, unknown>;

  if (message.type === "session.ping") {
    return { type: "session.ping" };
  }

  if (
    message.type === "session.heartbeat" &&
    typeof message.clientId === "string" &&
    message.clientId.length > 0
  ) {
    return {
      type: "session.heartbeat",
      clientId: message.clientId,
    };
  }

  return null;
}

export function encodeServerSessionMessage(message: ServerSessionMessage): string {
  return JSON.stringify(message);
}
