import { SessionActor as BaseSessionActor } from "./LegacyReconciliationSessionActor";
import type { SessionConnection } from "./protocol";
import { readRuntimeConfig } from "./runtimeConfigAccess";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";
import {
  refreshConnectionVisibility,
  sendAllVisibleCharacterSnapshots,
} from "./visibilityDelivery";

const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";
const CHARACTER_WRITE_ENVELOPES = new Set([
  "session.hp.operation",
  "session.sheet.operation",
  "session.conditions.operation",
  "session.abilities.operation",
  "session.magic.operation",
  "session.magic.operations",
  "session.equipment.operation",
  "session.inventory.operation",
  "session.proficiency.operation",
  "session.race.operation",
  "session.profile.operation",
]);

type BootstrapCharacterAdd = {
  characterId: string;
};

type CapabilityAwareConnection = SessionConnection & {
  canReadAnyCharacter?: boolean;
  canWriteAnyCharacter?: boolean;
};

/**
 * Final safety boundary for automatic relational -> Durable Object seeding.
 *
 * Normal MASTER lifecycle adds remain valid because session-only characters are
 * an intentional feature. Automatic bootstrap adds are different: they must be
 * members of the current session's Creation/runtime configuration. This keeps
 * stale browser/appState data from ever crossing campaign boundaries.
 *
 * Character-wide campaign capabilities are also materialized on the socket here.
 * MODERATOR remains a PLAYER runtime role for every MASTER-only operation. For
 * character mutations only, a socket proxy exposes MASTER ownership bypass to
 * the existing domain validators without ever persisting MASTER on the actual
 * connection attachment.
 */
export class SessionActor extends BaseSessionActor {
  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const canReadAnyCharacter =
      request.headers.get("x-session-can-read-any-character") === "1";
    const canWriteAnyCharacter =
      request.headers.get("x-session-can-write-any-character") === "1";
    if (!canReadAnyCharacter && !canWriteAnyCharacter) return response;

    const socket = this.ctx.getWebSockets().find((candidate) => {
      const connection = readConnection(candidate);
      return connection?.clientId === clientId;
    });
    if (!socket) return response;

    const connection = readConnection(socket) as CapabilityAwareConnection | null;
    if (!connection) return response;
    connection.canReadAnyCharacter = canReadAnyCharacter;
    connection.canWriteAnyCharacter = canWriteAnyCharacter;
    socket.serializeAttachment(connection);

    const [runtimeConfig, lifecycleState] = await Promise.all([
      readRuntimeConfig(this.ctx.storage),
      this.ctx.storage
        .get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)
        .then((value) => value ?? {}),
    ]);
    refreshConnectionVisibility(socket, runtimeConfig, lifecycleState);
    await sendAllVisibleCharacterSnapshots(this.ctx.storage, socket);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);
    const bootstrapAdd = parseBootstrapCharacterAdd(raw);

    if (bootstrapAdd) {
      const connection = readConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        return;
      }
      if (connection.role !== "MASTER") {
        sendError(
          webSocket,
          "MASTER_REQUIRED",
          "Only the MASTER can bootstrap session characters.",
        );
        return;
      }

      const runtimeConfig = await readRuntimeConfig(this.ctx.storage);
      if (!runtimeConfig) {
        sendError(
          webSocket,
          "SESSION_CONFIG_NOT_INITIALIZED",
          "Session configuration must be loaded before characters can be bootstrapped.",
        );
        return;
      }

      const configured = runtimeConfig.config.characters.some(
        (character) => character.characterId === bootstrapAdd.characterId,
      );
      if (!configured) {
        sendError(
          webSocket,
          "BOOTSTRAP_CHARACTER_NOT_CONFIGURED",
          "The bootstrap character does not belong to this session configuration.",
        );
        return;
      }

      await super.webSocketMessage(webSocket, message);
      return;
    }

    const connection = readConnection(webSocket) as CapabilityAwareConnection | null;
    if (
      connection
      && connection.role !== "MASTER"
      && connection.canWriteAnyCharacter === true
      && isCharacterWriteMessage(raw)
    ) {
      await super.webSocketMessage(
        createCharacterWriteAuthorizedSocket(webSocket, connection),
        message,
      );
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }
}

function parseBootstrapCharacterAdd(raw: string): BootstrapCharacterAdd | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value) || value.type !== "session.character.operation") {
    return null;
  }
  const operation = value.operation;
  if (
    !isRecord(operation)
    || operation.type !== "character.session.add"
    || operation.origin !== "bootstrap"
    || typeof operation.characterId !== "string"
    || !operation.characterId.trim()
  ) {
    return null;
  }

  return { characterId: operation.characterId.trim() };
}

function isCharacterWriteMessage(raw: string): boolean {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!isRecord(value) || !CHARACTER_WRITE_ENVELOPES.has(String(value.type))) {
    return false;
  }

  if (value.type === "session.magic.operations") {
    return Array.isArray(value.operations)
      && value.operations.length > 0
      && value.operations.every(isCharacterOperation);
  }

  const operation = value.operation;
  if (!isRecord(operation)) return false;
  if (isCharacterOperation(operation)) return true;

  if (value.type === "session.inventory.operation" && operation.type === "inventory.item.transfer") {
    const request = operation.request;
    if (!isRecord(request)) return false;
    return isCharacterLocation(request.from) || isCharacterLocation(request.to);
  }

  return false;
}

function isCharacterOperation(operation: unknown): boolean {
  if (!isRecord(operation)) return false;
  return (
    typeof operation.type === "string"
    && operation.type.startsWith("character.")
    && !operation.type.startsWith("character.session.")
    && typeof operation.characterId === "string"
    && operation.characterId.trim().length > 0
  );
}

function isCharacterLocation(value: unknown): boolean {
  return isRecord(value)
    && value.type === "character"
    && typeof value.characterId === "string"
    && value.characterId.trim().length > 0;
}

function createCharacterWriteAuthorizedSocket(
  socket: WebSocket,
  originalConnection: CapabilityAwareConnection,
): WebSocket {
  return new Proxy(socket, {
    get(target, property, receiver) {
      if (property === "deserializeAttachment") {
        return () => {
          const current = readConnection(target) as CapabilityAwareConnection | null;
          if (!current) return current;
          return {
            ...current,
            role: "MASTER" as const,
            canReadAnyCharacter: originalConnection.canReadAnyCharacter,
            canWriteAnyCharacter: originalConnection.canWriteAnyCharacter,
          };
        };
      }

      if (property === "serializeAttachment") {
        return (attachment: unknown) => {
          const next = isRecord(attachment)
            ? { ...attachment }
            : { ...originalConnection };
          next.role = originalConnection.role;
          next.canReadAnyCharacter = originalConnection.canReadAnyCharacter;
          next.canWriteAnyCharacter = originalConnection.canWriteAnyCharacter;
          target.serializeAttachment(next);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as WebSocket;
}

function readConnection(webSocket: WebSocket): SessionConnection | null {
  try {
    return webSocket.deserializeAttachment() as SessionConnection;
  } catch {
    return null;
  }
}

function sendError(webSocket: WebSocket, code: string, message: string): void {
  try {
    webSocket.send(JSON.stringify({ type: "session.error", code, message }));
  } catch {}
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}