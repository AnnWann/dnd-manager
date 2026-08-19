import { SessionActor as ComposedSessionActor } from "./ComposedSessionActor";
import { SessionActor as MissionSessionActor, MISSIONS_SHARED_SCOPE, MISSIONS_STATE_KEY, readMissionState } from "../missions/MissionSessionActor";
import { parseMissionClientMessage, type SessionMissionState } from "../missions/missionProtocol";
import { MAX_HP_LOG_RECORDS } from "../characters/sheet/hpState";
import type { SessionConnection } from "./protocol";
import {
  commitSessionUndo,
  createSessionLogRecord,
  readSessionLog,
  validateUndoOrdering,
  type SessionLogRecord,
} from "./sessionLog";

type MissionDomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type MissionReverse = {
  type: "session.missions.restore";
  characterId: "session";
  affectedScopes?: string[];
  snapshot: SessionMissionState;
};

/**
 * Final session actor boundary. Existing character domains remain composed by
 * ComposedSessionActor; shared mission state is layered here so its undo can
 * participate in the same unified session timeline without local fallback.
 */
export class SessionActor extends ComposedSessionActor {
  private readonly missionRoute = bindMissionActor(MissionSessionActor.prototype, this.ctx);

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;
    const socket = this.ctx.getWebSockets().find((candidate) => {
      try {
        const connection = candidate.deserializeAttachment() as { clientId?: unknown } | null;
        return connection?.clientId === clientId;
      } catch {
        return false;
      }
    });
    if (socket) send(socket, { type: "session.missions.snapshot", state: await readMissionState(this.ctx.storage) });
    return response;
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const undoLogId = parseUndoLogId(raw);
    if (undoLogId && await this.isMissionUndo(undoLogId)) {
      await this.handleMissionUndo(webSocket, undoLogId);
      return;
    }

    if (parseMissionClientMessage(raw)) {
      await this.missionRoute.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async isMissionUndo(logId: string): Promise<boolean> {
    const log = await readSessionLog(this.ctx.storage);
    return log.some((record) => record.id === logId && record.reverseOperation.type === "session.missions.restore");
  }

  private async handleMissionUndo(webSocket: WebSocket, logId: string): Promise<void> {
    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const log = await readSessionLog(this.ctx.storage);
    const validation = validateUndoOrdering(log, logId);
    if (!validation.ok) {
      sendError(webSocket, validation.code, validation.message);
      return;
    }
    if (validation.record.reverseOperation.type !== "session.missions.restore") {
      await super.webSocketMessage(webSocket, JSON.stringify({ type: "session.log.undo", logId }));
      return;
    }

    const reverse = validation.record.reverseOperation as unknown as MissionReverse;
    const current = await readMissionState(this.ctx.storage);
    const now = new Date().toISOString();
    const affectedScopes = validation.affectedScopes.length ? validation.affectedScopes : [MISSIONS_SHARED_SCOPE];
    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId: "session", sourceLogId: validation.record.id },
      affectedScopes,
      reverseOperation: {
        type: "session.missions.restore",
        characterId: "session",
        affectedScopes,
        snapshot: structuredClone(current),
      },
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [MISSIONS_STATE_KEY]: reverse.snapshot },
      currentLog: log,
      sourceIndex: validation.index,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_HP_LOG_RECORDS,
      undoneAt: now,
    });
    broadcast(this.ctx.getWebSockets(), { type: "session.missions.updated", state: reverse.snapshot });
  }
}

function bindMissionActor<T extends MissionDomainActor>(prototype: T, ctx: DurableObjectState): T {
  const actor = Object.create(null) as T;
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (descriptor) Object.defineProperty(actor, key, descriptor);
  }
  Object.defineProperty(actor, "ctx", {
    value: ctx,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string" ? value.logId : null;
  } catch {
    return null;
  }
}
function readConnection(socket: WebSocket): SessionConnection | null {
  try { return socket.deserializeAttachment() as SessionConnection | null; } catch { return null; }
}
function sendError(socket: WebSocket, code: string, message: string): void {
  send(socket, { type: "session.error", code, message });
}
function send(socket: WebSocket, value: unknown): void {
  try { socket.send(JSON.stringify(value)); } catch {}
}
function broadcast(sockets: WebSocket[], value: unknown): void {
  const payload = JSON.stringify(value);
  for (const socket of sockets) {
    try { socket.send(payload); } catch {}
  }
}
