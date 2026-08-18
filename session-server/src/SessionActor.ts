import { DurableObject } from "cloudflare:workers";
import {
  applyHpOperation,
  applyHpUndo,
  defaultAttributes,
  defaultSavingThrows,
  defaultStats,
  MAX_HP_LOG_RECORDS,
  normalizeAttributesSeed,
  normalizeHpSeed,
  normalizeSavingThrowsSeed,
  normalizeStatsSeed,
} from "./hpState";
import {
  encodeServerSessionMessage,
  parseClientSessionMessage,
  type ServerSessionMessage,
  type SessionConnection,
  type SessionDieSides,
  type SessionHpLogRecord,
  type SessionHpSeed,
  type SessionHpState,
  type SessionPresenceUser,
} from "./protocol";

const CONNECTION_TIMEOUT_MS = 90_000;
const CLOSE_CODE_TIMEOUT = 4000;
const CLOSE_CODE_REPLACED = 4001;
const HP_STATE_KEY = "hp-state";
const HP_LOG_KEY = "hp-log";

type StoredSessionHpState = SessionHpState & {
  /** Distinguishes an old HP-only state from an intentionally empty hit-dice state. */
  hitDiceInitialized?: boolean;
};

export class SessionActor extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade.", { status: 426 });
    }
    const connection = this.readConnectionHeaders(request);
    if (!connection) return new Response("Invalid session connection metadata.", { status: 400 });

    this.replaceExistingClientConnection(connection.clientId);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment(connection);
    this.ctx.acceptWebSocket(server);

    this.send(server, { type: "session.ready", sessionId: connection.sessionId, clientId: connection.clientId, serverTime: Date.now() });
    await this.sendHpSnapshot(server);
    if (connection.role === "MASTER") await this.sendHpLog(server);
    this.broadcastPresence();
    await this.scheduleNextAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseClientSessionMessage(raw);
    if (!parsed) {
      this.sendError(webSocket, "INVALID_MESSAGE", "Unsupported or malformed session message.");
      return;
    }

    const connection = this.getConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    if (parsed.type === "session.heartbeat" && parsed.clientId !== connection.clientId) {
      this.sendError(webSocket, "CLIENT_ID_MISMATCH", "Heartbeat clientId does not match this connection.");
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    switch (parsed.type) {
      case "session.heartbeat":
        this.send(webSocket, { type: "session.heartbeat.ack", serverTime: Date.now() });
        break;
      case "session.ping":
        this.send(webSocket, { type: "session.pong", serverTime: Date.now() });
        break;
      case "session.hp.initialize":
        await this.initializeHp(webSocket, connection, parsed.characters);
        break;
      case "session.hp.operation":
        await this.handleHpOperation(webSocket, connection, parsed.operation);
        break;
      case "session.log.undo":
        await this.handleUndo(webSocket, connection, parsed.logId);
        break;
    }
    await this.scheduleNextAlarm();
  }

  async webSocketClose(): Promise<void> {
    this.broadcastPresence();
    await this.scheduleNextAlarm();
  }

  async webSocketError(webSocket: WebSocket): Promise<void> {
    try { webSocket.close(1011, "WebSocket error"); }
    finally {
      this.broadcastPresence();
      await this.scheduleNextAlarm();
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        continue;
      }
      if (now - connection.lastHeartbeatAt >= CONNECTION_TIMEOUT_MS) {
        webSocket.close(CLOSE_CODE_TIMEOUT, "Session heartbeat timeout");
      }
    }
    this.broadcastPresence(now);
    await this.scheduleNextAlarm(now);
  }

  private async initializeHp(
    webSocket: WebSocket,
    connection: SessionConnection,
    seeds: SessionHpSeed[],
  ): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can initialize authoritative character state.");
      return;
    }

    const state = await this.readHpState();
    let changed = false;

    for (const seed of seeds) {
      const normalized = normalizeHpSeed(seed);
      const existing = state[seed.characterId];
      if (!existing) {
        state[seed.characterId] = {
          ...normalized,
          hitDiceInitialized: seed.hitDice !== undefined,
        };
        changed = true;
        continue;
      }

      let next = existing;
      let entryChanged = false;

      if (existing.hitDiceInitialized !== true && seed.hitDice !== undefined) {
        const nextHitDice = { ...(existing.hitDice ?? {}) };
        for (const [side, pool] of Object.entries(normalized.hitDice)) {
          const typedSide = side as SessionDieSides;
          if (!pool || nextHitDice[typedSide]) continue;
          nextHitDice[typedSide] = pool;
        }
        next = { ...next, hitDice: nextHitDice, hitDiceInitialized: true };
        entryChanged = true;
      }

      if (existing.statsInitialized !== true && seed.stats !== undefined) {
        next = {
          ...next,
          stats: normalizeStatsSeed(seed.stats),
          statsInitialized: true,
        };
        entryChanged = true;
      }

      if (existing.attributesInitialized !== true && seed.attributes !== undefined) {
        next = {
          ...next,
          attributes: normalizeAttributesSeed(seed.attributes),
          attributesInitialized: true,
        };
        entryChanged = true;
      }

      if (existing.savingThrowsInitialized !== true && seed.savingThrows !== undefined) {
        next = {
          ...next,
          savingThrows: normalizeSavingThrowsSeed(seed.savingThrows),
          savingThrowsInitialized: true,
        };
        entryChanged = true;
      }

      if (entryChanged) {
        state[seed.characterId] = next;
        changed = true;
      }
    }

    if (changed) {
      await this.ctx.storage.put(HP_STATE_KEY, state);
      await this.broadcastHpSnapshot();
    } else {
      await this.sendHpSnapshot(webSocket);
    }
  }

  private async handleHpOperation(
    webSocket: WebSocket,
    connection: SessionConnection,
    operation: Parameters<typeof applyHpOperation>[1],
  ): Promise<void> {
    const [state, log] = await Promise.all([this.readHpState(), this.readHpLog()]);
    const current = state[operation.characterId];
    if (!current) {
      this.sendError(webSocket, "HP_NOT_INITIALIZED", "Authoritative state for this character has not been initialized by the MASTER.");
      return;
    }

    const result = applyHpOperation(current, operation, connection);
    if (!result.ok) {
      this.sendError(webSocket, result.code, result.message);
      return;
    }

    const storedNext: StoredSessionHpState = {
      ...result.next,
      hitDiceInitialized: current.hitDiceInitialized ?? true,
    };
    state[operation.characterId] = storedNext;
    log.push(result.record);
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);
    await this.ctx.storage.put({ [HP_STATE_KEY]: state, [HP_LOG_KEY]: nextLog });
    this.broadcast({ type: "session.hp.updated", character: result.next });
    this.broadcastHpLogToMasters(nextLog);
  }

  private async handleUndo(webSocket: WebSocket, connection: SessionConnection, logId: string): Promise<void> {
    if (connection.role !== "MASTER") {
      this.sendError(webSocket, "MASTER_REQUIRED", "Only the MASTER can undo session changes.");
      return;
    }

    const [state, log] = await Promise.all([this.readHpState(), this.readHpLog()]);
    const sourceIndex = log.findIndex((record) => record.id === logId);
    if (sourceIndex < 0) {
      this.sendError(webSocket, "LOG_NOT_FOUND", "The selected log entry no longer exists.");
      return;
    }

    const source = log[sourceIndex];
    if (source.operation.type === "character.hp.undo") {
      this.sendError(webSocket, "UNDO_OF_UNDO_NOT_SUPPORTED", "Undo records cannot be undone.");
      return;
    }

    const characterId = source.reverseOperation.characterId;
    const newerActiveChange = log.slice(sourceIndex + 1).some(
      (record) => !record.undoneAt && record.operation.type !== "character.hp.undo" && record.reverseOperation.characterId === characterId,
    );
    if (newerActiveChange) {
      this.sendError(webSocket, "UNDO_NOT_LATEST", "Undo newer changes for this character first.");
      return;
    }

    const current = state[characterId];
    if (!current) {
      this.sendError(webSocket, "HP_NOT_INITIALIZED", "Authoritative state for this character is missing.");
      return;
    }

    const result = applyHpUndo(current, source, connection);
    if (!result.ok) {
      this.sendError(webSocket, result.code, result.message);
      return;
    }

    const now = new Date().toISOString();
    log[sourceIndex] = { ...source, undoneAt: now, undoneBy: connection.userId };
    log.push(result.record);
    state[characterId] = {
      ...result.next,
      hitDiceInitialized: current.hitDiceInitialized ?? true,
    };
    const nextLog = log.slice(-MAX_HP_LOG_RECORDS);
    await this.ctx.storage.put({ [HP_STATE_KEY]: state, [HP_LOG_KEY]: nextLog });
    this.broadcast({ type: "session.hp.updated", character: result.next });
    this.broadcastHpLogToMasters(nextLog);
  }

  private async readHpState(): Promise<Record<string, StoredSessionHpState>> {
    const raw = (await this.ctx.storage.get<Record<string, StoredSessionHpState>>(HP_STATE_KEY)) ?? {};
    return Object.fromEntries(
      Object.entries(raw).map(([id, state]) => [id, {
        ...state,
        hitDice: state.hitDice ?? {},
        stats: state.stats ?? defaultStats(),
        statsInitialized: state.statsInitialized ?? false,
        attributes: state.attributes ?? defaultAttributes(),
        attributesInitialized: state.attributesInitialized ?? false,
        savingThrows: state.savingThrows ?? defaultSavingThrows(),
        savingThrowsInitialized: state.savingThrowsInitialized ?? false,
      }]),
    );
  }

  private async readHpLog(): Promise<SessionHpLogRecord[]> {
    return (await this.ctx.storage.get<SessionHpLogRecord[]>(HP_LOG_KEY)) ?? [];
  }

  private async sendHpSnapshot(webSocket: WebSocket): Promise<void> {
    const state = await this.readHpState();
    this.send(webSocket, { type: "session.hp.snapshot", characters: Object.values(state) });
  }

  private async broadcastHpSnapshot(): Promise<void> {
    const state = await this.readHpState();
    this.broadcast({ type: "session.hp.snapshot", characters: Object.values(state) });
  }

  private async sendHpLog(webSocket: WebSocket): Promise<void> {
    this.send(webSocket, { type: "session.hp.log", records: await this.readHpLog() });
  }

  private broadcastHpLogToMasters(records: SessionHpLogRecord[]): void {
    const message: ServerSessionMessage = { type: "session.hp.log", records };
    for (const socket of this.activeSockets()) {
      if (this.getConnection(socket)?.role === "MASTER") this.send(socket, message);
    }
  }

  private readConnectionHeaders(request: Request): SessionConnection | null {
    const sessionId = request.headers.get("x-session-id")?.trim();
    const clientId = request.headers.get("x-session-client-id")?.trim();
    const userId = request.headers.get("x-session-user-id")?.trim();
    const role = request.headers.get("x-session-role")?.trim();
    const expiresAt = Number(request.headers.get("x-session-expires-at"));
    if (!sessionId || !clientId || !userId || (role !== "MASTER" && role !== "PLAYER") || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    const now = Date.now();
    return { sessionId, clientId, userId, role, connectedAt: now, lastHeartbeatAt: now };
  }

  private replaceExistingClientConnection(clientId: string): void {
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (connection?.clientId === clientId) webSocket.close(CLOSE_CODE_REPLACED, "Connection replaced by reconnect");
    }
  }

  private getConnection(webSocket: WebSocket): SessionConnection | null {
    try { return webSocket.deserializeAttachment() as SessionConnection; }
    catch { return null; }
  }

  private sendError(webSocket: WebSocket, code: string, message: string): void {
    this.send(webSocket, { type: "session.error", code, message });
  }

  private send(webSocket: WebSocket, message: ServerSessionMessage): void {
    try { webSocket.send(encodeServerSessionMessage(message)); } catch {}
  }

  private broadcast(message: ServerSessionMessage): void {
    const payload = encodeServerSessionMessage(message);
    for (const webSocket of this.activeSockets()) {
      try { webSocket.send(payload); } catch {}
    }
  }

  private activeSockets(now = Date.now()): WebSocket[] {
    return this.ctx.getWebSockets().filter((webSocket) => {
      const connection = this.getConnection(webSocket);
      return connection !== null && now - connection.lastHeartbeatAt < CONNECTION_TIMEOUT_MS;
    });
  }

  private broadcastPresence(now = Date.now()): void {
    const activeSockets = this.activeSockets(now);
    const users: SessionPresenceUser[] = activeSockets.flatMap((webSocket) => {
      const connection = this.getConnection(webSocket);
      return connection ? [{ userId: connection.userId, clientId: connection.clientId, role: connection.role }] : [];
    });
    const payload = encodeServerSessionMessage({ type: "session.presence", users });
    for (const webSocket of activeSockets) {
      try { webSocket.send(payload); } catch {}
    }
  }

  private async scheduleNextAlarm(now = Date.now()): Promise<void> {
    let nextDeadline: number | null = null;
    for (const webSocket of this.ctx.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (!connection) continue;
      const deadline = connection.lastHeartbeatAt + CONNECTION_TIMEOUT_MS;
      if (deadline <= now) continue;
      if (nextDeadline === null || deadline < nextDeadline) nextDeadline = deadline;
    }
    if (nextDeadline === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(nextDeadline);
  }
}
