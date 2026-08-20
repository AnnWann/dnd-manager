import { SessionActor as ComposedSessionActor } from "./ComposedSessionActor";
import { SessionActor as MissionSessionActor, MISSIONS_SHARED_SCOPE, MISSIONS_STATE_KEY, readMissionState } from "../missions/MissionSessionActor";
import { parseMissionClientMessage, type SessionMissionState } from "../missions/missionProtocol";
import { SessionActor as InitiativeSessionActor, INITIATIVE_SHARED_SCOPE, INITIATIVE_STATE_KEY, readInitiativeState } from "../initiative/InitiativeSessionActor";
import { parseInitiativeClientMessage, type SessionInitiativeState } from "../initiative/initiativeProtocol";
import { MAX_HP_LOG_RECORDS } from "../characters/sheet/hpState";
import type { SessionConnection } from "./protocol";
import {
  parseRuntimeConfigPublishMessage,
} from "./runtimeConfigProtocol";
import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import {
  RUNTIME_CONFIG_STATE_KEY,
  authorizeCharacterMutation,
  extractOperationCharacterId,
  readRuntimeConfig,
} from "./runtimeConfigAccess";
import {
  commitSessionUndo,
  createSessionLogRecord,
  readSessionLog,
  validateUndoOrdering,
} from "./sessionLog";

export { RUNTIME_CONFIG_STATE_KEY } from "./runtimeConfigAccess";

type SharedDomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type SharedReverse =
  | {
      type: "session.missions.restore";
      characterId: "session";
      affectedScopes?: string[];
      snapshot: SessionMissionState;
    }
  | {
      type: "session.initiative.restore";
      characterId: "session";
      affectedScopes?: string[];
      snapshot: SessionInitiativeState;
    };

/** Final shared-domain boundary layered over the composed character authority. */
export class SessionActor extends ComposedSessionActor {
  private readonly missionRoute = bindDomainActor(MissionSessionActor.prototype, this.ctx);
  private readonly initiativeRoute = bindDomainActor(InitiativeSessionActor.prototype, this.ctx);

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
    if (socket) {
      const [missions, initiative, runtimeConfig] = await Promise.all([
        readMissionState(this.ctx.storage),
        readInitiativeState(this.ctx.storage),
        readRuntimeConfig(this.ctx.storage),
      ]);
      send(socket, { type: "session.missions.snapshot", state: missions });
      send(socket, { type: "session.initiative.snapshot", state: initiative });
      send(socket, { type: "session.config.snapshot", snapshot: runtimeConfig });
    }
    return response;
  }

  override async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);

    const runtimeConfig = parseRuntimeConfigPublishMessage(raw);
    if (runtimeConfig) {
      await this.handleRuntimeConfigPublish(webSocket, runtimeConfig.snapshot);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }

    const characterId = extractOperationCharacterId(raw);
    if (characterId) {
      const authorization = authorizeCharacterMutation(
        connection,
        await readRuntimeConfig(this.ctx.storage),
        characterId,
      );
      if (!authorization.ok) {
        sendError(webSocket, authorization.code, authorization.message);
        return;
      }
    }

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      const reverseType = await this.sharedUndoType(undoLogId);
      if (reverseType) {
        await this.handleSharedUndo(webSocket, undoLogId, reverseType);
        return;
      }
    }

    if (parseMissionClientMessage(raw)) {
      await this.missionRoute.webSocketMessage(webSocket, message);
      return;
    }
    if (parseInitiativeClientMessage(raw)) {
      await this.initiativeRoute.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async handleRuntimeConfigPublish(
    webSocket: WebSocket,
    snapshot: SessionRuntimeConfigSnapshot,
  ): Promise<void> {
    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (connection.role !== "MASTER") {
      sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can publish session configuration.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const current = await readRuntimeConfig(this.ctx.storage);
    if (current && snapshot.creationRevision < current.creationRevision) {
      sendError(
        webSocket,
        "CREATION_CONFIG_STALE",
        `Creation revision ${snapshot.creationRevision} is older than active revision ${current.creationRevision}.`,
      );
      send(webSocket, { type: "session.config.snapshot", snapshot: current });
      return;
    }

    if (
      current
      && snapshot.creationRevision === current.creationRevision
      && JSON.stringify(snapshot.config) !== JSON.stringify(current.config)
    ) {
      sendError(
        webSocket,
        "CREATION_CONFIG_REVISION_COLLISION",
        "A different runtime configuration already exists for this Creation revision.",
      );
      send(webSocket, { type: "session.config.snapshot", snapshot: current });
      return;
    }

    if (!current || snapshot.creationRevision > current.creationRevision) {
      await this.ctx.storage.put(RUNTIME_CONFIG_STATE_KEY, structuredClone(snapshot));
      broadcast(this.ctx.getWebSockets(), {
        type: "session.config.snapshot",
        snapshot,
      });
      return;
    }

    // Equal revision + equal content is an idempotent republish after reconnect.
    send(webSocket, { type: "session.config.snapshot", snapshot: current });
  }

  private async sharedUndoType(logId: string): Promise<SharedReverse["type"] | null> {
    const log = await readSessionLog(this.ctx.storage);
    const record = log.find((entry) => entry.id === logId);
    const type = record?.reverseOperation.type;
    return type === "session.missions.restore" || type === "session.initiative.restore" ? type : null;
  }

  private async handleSharedUndo(
    webSocket: WebSocket,
    logId: string,
    reverseType: SharedReverse["type"],
  ): Promise<void> {
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
    if (validation.record.reverseOperation.type !== reverseType) {
      await super.webSocketMessage(webSocket, JSON.stringify({ type: "session.log.undo", logId }));
      return;
    }

    const reverse = validation.record.reverseOperation as unknown as SharedReverse;
    const now = new Date().toISOString();
    const isMissions = reverse.type === "session.missions.restore";
    const current = isMissions
      ? await readMissionState(this.ctx.storage)
      : await readInitiativeState(this.ctx.storage);
    const scope = isMissions ? MISSIONS_SHARED_SCOPE : INITIATIVE_SHARED_SCOPE;
    const stateKey = isMissions ? MISSIONS_STATE_KEY : INITIATIVE_STATE_KEY;
    const affectedScopes = validation.affectedScopes.length ? validation.affectedScopes : [scope];
    const inverseReverse: SharedReverse = isMissions
      ? {
          type: "session.missions.restore",
          characterId: "session",
          affectedScopes,
          snapshot: structuredClone(current as SessionMissionState),
        }
      : {
          type: "session.initiative.restore",
          characterId: "session",
          affectedScopes,
          snapshot: structuredClone(current as SessionInitiativeState),
        };
    const undoRecord = createSessionLogRecord({
      actorId: connection.userId,
      createdAt: now,
      operation: { type: "character.hp.undo", characterId: "session", sourceLogId: validation.record.id },
      affectedScopes,
      reverseOperation: inverseReverse,
    });

    await commitSessionUndo(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [stateKey]: reverse.snapshot },
      currentLog: log,
      sourceIndex: validation.index,
      userId: connection.userId,
      undoRecord,
      maxRecords: MAX_HP_LOG_RECORDS,
      undoneAt: now,
    });
    broadcast(this.ctx.getWebSockets(), isMissions
      ? { type: "session.missions.updated", state: reverse.snapshot }
      : { type: "session.initiative.updated", state: reverse.snapshot });
  }
}

function bindDomainActor<T extends SharedDomainActor>(prototype: T, ctx: DurableObjectState): T {
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
