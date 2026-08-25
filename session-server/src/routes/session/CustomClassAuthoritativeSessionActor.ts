import { SessionActor as BaseSessionActor } from "./AuthoritativeSessionActor";
import { SessionActor as CustomClassSessionActor } from "../characters/classes/CustomClassSessionActor";
import { parseCustomClassClientMessage } from "../characters/classes/customClassProtocol";
import type { SessionConnection } from "./protocol";
import {
  authorizeCharacterMutation,
  readRuntimeConfig,
} from "./runtimeConfigAccess";
import { createVisibilityFilteredContext } from "./visibilityDelivery";

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
