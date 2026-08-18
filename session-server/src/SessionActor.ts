import {
  encodeServerSessionMessage,
  parseClientSessionMessage,
  type ServerSessionMessage,
  type SessionConnection,
  type SessionPresenceUser,
} from "./protocol";

const CONNECTION_TIMEOUT_MS = 90_000;
const CLOSE_CODE_TIMEOUT = 4000;
const CLOSE_CODE_REPLACED = 4001;

export class SessionActor implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: unknown,
  ) {
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade.", { status: 426 });
    }

    const connection = this.readConnectionHeaders(request);
    if (!connection) {
      return new Response("Invalid session connection metadata.", { status: 400 });
    }

    this.replaceExistingClientConnection(connection.clientId);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.serializeAttachment(connection);
    this.state.acceptWebSocket(server);

    this.send(server, {
      type: "session.ready",
      sessionId: connection.sessionId,
      clientId: connection.clientId,
      serverTime: Date.now(),
    });

    this.broadcastPresence();
    await this.scheduleNextAlarm();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseClientSessionMessage(raw);

    if (!parsed) {
      this.send(webSocket, {
        type: "session.error",
        code: "INVALID_MESSAGE",
        message: "Unsupported or malformed session message.",
      });
      return;
    }

    const connection = this.getConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }

    if (
      parsed.type === "session.heartbeat" &&
      parsed.clientId !== connection.clientId
    ) {
      this.send(webSocket, {
        type: "session.error",
        code: "CLIENT_ID_MISMATCH",
        message: "Heartbeat clientId does not match this connection.",
      });
      return;
    }

    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    if (parsed.type === "session.heartbeat") {
      this.send(webSocket, {
        type: "session.heartbeat.ack",
        serverTime: Date.now(),
      });
    } else {
      this.send(webSocket, {
        type: "session.pong",
        serverTime: Date.now(),
      });
    }

    await this.scheduleNextAlarm();
  }

  async webSocketClose(
    _webSocket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    this.broadcastPresence();
    await this.scheduleNextAlarm();
  }

  async webSocketError(webSocket: WebSocket): Promise<void> {
    try {
      webSocket.close(1011, "WebSocket error");
    } finally {
      this.broadcastPresence();
      await this.scheduleNextAlarm();
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();

    for (const webSocket of this.state.getWebSockets()) {
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

  private readConnectionHeaders(request: Request): SessionConnection | null {
    const sessionId = request.headers.get("x-session-id")?.trim();
    const clientId = request.headers.get("x-session-client-id")?.trim();
    const userId = request.headers.get("x-session-user-id")?.trim();
    const role = request.headers.get("x-session-role")?.trim();
    const expiresAt = Number(request.headers.get("x-session-expires-at"));

    if (
      !sessionId ||
      !clientId ||
      !userId ||
      (role !== "MASTER" && role !== "PLAYER") ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return null;
    }

    const now = Date.now();
    return {
      sessionId,
      clientId,
      userId,
      role,
      connectedAt: now,
      lastHeartbeatAt: now,
    };
  }

  private replaceExistingClientConnection(clientId: string): void {
    for (const webSocket of this.state.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (connection?.clientId === clientId) {
        webSocket.close(CLOSE_CODE_REPLACED, "Connection replaced by reconnect");
      }
    }
  }

  private getConnection(webSocket: WebSocket): SessionConnection | null {
    try {
      return webSocket.deserializeAttachment() as SessionConnection;
    } catch {
      return null;
    }
  }

  private send(webSocket: WebSocket, message: ServerSessionMessage): void {
    try {
      webSocket.send(encodeServerSessionMessage(message));
    } catch {
      // The socket may have closed between enumeration and send.
    }
  }

  private broadcastPresence(now = Date.now()): void {
    const activeSockets = this.state.getWebSockets().filter((webSocket) => {
      const connection = this.getConnection(webSocket);
      return (
        connection !== null &&
        now - connection.lastHeartbeatAt < CONNECTION_TIMEOUT_MS
      );
    });

    const users: SessionPresenceUser[] = activeSockets.flatMap((webSocket) => {
      const connection = this.getConnection(webSocket);
      if (!connection) return [];

      return [
        {
          userId: connection.userId,
          clientId: connection.clientId,
          role: connection.role,
        },
      ];
    });

    const payload = encodeServerSessionMessage({
      type: "session.presence",
      users,
    });

    for (const webSocket of activeSockets) {
      try {
        webSocket.send(payload);
      } catch {
        // Ignore sockets that close while broadcasting.
      }
    }
  }

  private async scheduleNextAlarm(now = Date.now()): Promise<void> {
    let nextDeadline: number | null = null;

    for (const webSocket of this.state.getWebSockets()) {
      const connection = this.getConnection(webSocket);
      if (!connection) continue;

      const deadline = connection.lastHeartbeatAt + CONNECTION_TIMEOUT_MS;
      if (deadline <= now) continue;

      if (nextDeadline === null || deadline < nextDeadline) {
        nextDeadline = deadline;
      }
    }

    if (nextDeadline === null) {
      await this.state.storage.deleteAlarm();
      return;
    }

    await this.state.storage.setAlarm(nextDeadline);
  }
}
