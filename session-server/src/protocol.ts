export type SessionRole = "MASTER" | "PLAYER";

export type SessionConnection = {
  sessionId: string;
  clientId: string;
  userId: string;
  role: SessionRole;
  connectedAt: number;
  lastHeartbeatAt: number;
};

export type SessionHpState = {
  characterId: string;
  ownerUserId?: string;
  current: number;
  temporary: number;
  max: number;
  currentMax: number;
  maxHpBonus: number;
  revision: number;
};

export type SessionHpSeed = Omit<SessionHpState, "revision">;

export type SessionHpOperation =
  | { type: "character.hp.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.add"; characterId: string; amount: number }
  | {
      type: "character.hp.damage";
      characterId: string;
      amount: number;
      requiresConcentrationCheck?: boolean;
      concentrationDc?: number;
      concentrationSource?: string;
    }
  | { type: "character.hp.heal"; characterId: string; amount: number }
  | { type: "character.hp.max.set"; characterId: string; value: number }
  | { type: "character.hp.currentMax.adjust"; characterId: string; amount: number }
  | { type: "character.hp.currentMax.restore"; characterId: string };

/**
 * Rest is a domain operation, not a collection of HP/resource micro-events.
 * Only HP is authoritative today; future migrated rest domains must be added
 * to the same operation/reverse snapshot instead of creating extra log rows.
 */
export type SessionRestOperation =
  | {
      type: "character.rest.short";
      characterId: string;
      healing: number;
    }
  | {
      type: "character.rest.long";
      characterId: string;
      recovery: "partial" | "full";
    };

export type SessionAuthoritativeOperation =
  | SessionHpOperation
  | SessionRestOperation;

export type SessionHpReverseOperation = {
  type: "character.hp.restore";
  characterId: string;
  hp: SessionHpState;
};

export type SessionRestReverseOperation = {
  type: "character.rest.restore";
  characterId: string;
  snapshot: {
    hp: SessionHpState;
    // Add hit dice, resources, conditions, supplies, etc. here as each domain
    // becomes authoritative. A rest must remain one atomic reversible event.
  };
};

export type SessionReverseOperation =
  | SessionHpReverseOperation
  | SessionRestReverseOperation;

export type SessionHpLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation:
    | SessionAuthoritativeOperation
    | { type: "character.hp.undo"; characterId: string; sourceLogId: string };
  reverseOperation: SessionReverseOperation;
  undoneAt?: string;
  undoneBy?: string;
};

export type SessionHeartbeatMessage = {
  type: "session.heartbeat";
  clientId: string;
};

export type SessionPingMessage = {
  type: "session.ping";
};

export type SessionHpInitializeMessage = {
  type: "session.hp.initialize";
  characters: SessionHpSeed[];
};

export type SessionHpOperationMessage = {
  type: "session.hp.operation";
  operation: SessionAuthoritativeOperation;
};

export type SessionLogUndoMessage = {
  type: "session.log.undo";
  logId: string;
};

export type ClientSessionMessage =
  | SessionHeartbeatMessage
  | SessionPingMessage
  | SessionHpInitializeMessage
  | SessionHpOperationMessage
  | SessionLogUndoMessage;

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

export type SessionHpSnapshotMessage = {
  type: "session.hp.snapshot";
  characters: SessionHpState[];
};

export type SessionHpUpdatedMessage = {
  type: "session.hp.updated";
  character: SessionHpState;
};

export type SessionHpLogMessage = {
  type: "session.hp.log";
  records: SessionHpLogRecord[];
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
  | SessionHpSnapshotMessage
  | SessionHpUpdatedMessage
  | SessionHpLogMessage
  | SessionErrorMessage;

export function parseClientSessionMessage(raw: string): ClientSessionMessage | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "session.ping") return { type: "session.ping" };

  if (
    value.type === "session.heartbeat" &&
    typeof value.clientId === "string" &&
    value.clientId.length > 0
  ) {
    return { type: "session.heartbeat", clientId: value.clientId };
  }

  if (
    value.type === "session.log.undo" &&
    typeof value.logId === "string" &&
    value.logId.length > 0
  ) {
    return { type: "session.log.undo", logId: value.logId };
  }

  if (value.type === "session.hp.initialize" && Array.isArray(value.characters)) {
    const characters = value.characters.filter(isHpSeed);
    if (characters.length !== value.characters.length) return null;
    return { type: "session.hp.initialize", characters };
  }

  if (
    value.type === "session.hp.operation" &&
    isAuthoritativeOperation(value.operation)
  ) {
    return { type: "session.hp.operation", operation: value.operation };
  }

  return null;
}

function isHpSeed(value: unknown): value is SessionHpSeed {
  if (!isRecord(value)) return false;
  return (
    typeof value.characterId === "string" &&
    value.characterId.length > 0 &&
    (value.ownerUserId === undefined || typeof value.ownerUserId === "string") &&
    isFiniteNumber(value.current) &&
    isFiniteNumber(value.temporary) &&
    isFiniteNumber(value.max) &&
    isFiniteNumber(value.currentMax) &&
    isFiniteNumber(value.maxHpBonus)
  );
}

function isAuthoritativeOperation(
  value: unknown,
): value is SessionAuthoritativeOperation {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    typeof value.characterId !== "string" ||
    value.characterId.length === 0
  ) {
    return false;
  }

  switch (value.type) {
    case "character.hp.set":
    case "character.hp.temporary.set":
    case "character.hp.max.set":
      return isFiniteNumber(value.value);
    case "character.hp.temporary.add":
    case "character.hp.damage":
    case "character.hp.heal":
    case "character.hp.currentMax.adjust":
      return isFiniteNumber(value.amount);
    case "character.hp.currentMax.restore":
      return true;
    case "character.rest.short":
      return isFiniteNumber(value.healing);
    case "character.rest.long":
      return value.recovery === "partial" || value.recovery === "full";
    default:
      return false;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function encodeServerSessionMessage(message: ServerSessionMessage): string {
  return JSON.stringify(message);
}
