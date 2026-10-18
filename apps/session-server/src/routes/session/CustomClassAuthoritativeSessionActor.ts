import { SessionActor as BaseSessionActor } from "./AuthoritativeSessionActor";
import { SessionActor as CustomClassSessionActor } from "../characters/classes/CustomClassSessionActor";
import { parseCustomClassClientMessage } from "../characters/classes/customClassProtocol";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";
import type { SessionConnection } from "./protocol";
import {
  authorizeCharacterMutation,
  readRuntimeConfig,
  visibleRuntimeConfigSnapshot,
} from "./runtimeConfigAccess";
import {
  createVisibilityFilteredContext,
  refreshConnectionVisibility,
  sendAllVisibleCharacterSnapshots,
  sendVisibilityFiltered,
} from "./visibilityDelivery";

type DomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

/**
 * Final character-definition operation layer. Custom-class configuration is a
 * single semantic mutation over the authoritative character snapshot; all
 * other runtime messages continue through the existing composed actor chain.
 */
export class SessionActor extends BaseSessionActor {
  private readonly customClassRoute = bindDomainActor(
    CustomClassSessionActor.prototype,
    this.ctx,
  );

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) => {
      const connection = readConnection(candidate);
      return connection?.clientId === clientId;
    });
    if (!socket) return response;

    const [runtimeConfig, lifecycleState] = await Promise.all([
      readRuntimeConfig(this.ctx.storage),
      this.ctx.storage
        .get<Record<string, SessionCharacterLifecycleState>>("characters-state")
        .then((value) => value ?? {}),
    ]);

    // Ownership is a projection of the Durable Object lifecycle state. The
    // connection token authenticates access only and never supplies ownership.
    refreshConnectionVisibility(socket, runtimeConfig, lifecycleState);

    const connection = readConnection(socket);
    if (!connection) {
      socket.close(1011, "Missing connection attachment");
      return response;
    }

    // Earlier actor layers intentionally send only party-visible data until
    // authoritative ownership is hydrated. Re-send the player projection now.
    sendVisibilityFiltered(socket, {
      type: "session.config.snapshot",
      snapshot: visibleRuntimeConfigSnapshot(connection, runtimeConfig),
    });
    await sendAllVisibleCharacterSnapshots(this.ctx.storage, socket);

    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseCustomClassClientMessage(raw);
    if (!parsed) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = readConnection(webSocket);
    if (!connection) {
      webSocket.close(1011, "Missing connection attachment");
      return;
    }
    connection.lastHeartbeatAt = Date.now();
    webSocket.serializeAttachment(connection);

    const authorization = authorizeCharacterMutation(
      connection,
      await readRuntimeConfig(this.ctx.storage),
      parsed.operation.characterId,
    );
    if (!authorization.ok) {
      sendError(webSocket, authorization.code, authorization.message);
      return;
    }

    await this.customClassRoute.webSocketMessage(webSocket, message);
  }
}

function bindDomainActor<T extends DomainActor>(prototype: T, ctx: DurableObjectState): T {
  const actor = Object.create(null) as T;
  for (const key of Reflect.ownKeys(prototype)) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (descriptor) Object.defineProperty(actor, key, descriptor);
  }
  Object.defineProperty(actor, "ctx", {
    value: createVisibilityFilteredContext(ctx),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function readConnection(socket: WebSocket): SessionConnection | null {
  try {
    return socket.deserializeAttachment() as SessionConnection;
  } catch {
    return null;
  }
}

function sendError(socket: WebSocket, code: string, message: string): void {
  try {
    socket.send(JSON.stringify({ type: "session.error", code, message }));
  } catch {}
}
