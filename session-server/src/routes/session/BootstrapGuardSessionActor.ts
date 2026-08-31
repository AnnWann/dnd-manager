import { SessionActor as BaseSessionActor } from "./LegacyReconciliationSessionActor";
import type { SessionConnection } from "./protocol";
import { readRuntimeConfig } from "./runtimeConfigAccess";

type BootstrapCharacterAdd = {
  characterId: string;
};

/**
 * Final safety boundary for automatic relational -> Durable Object seeding.
 *
 * Normal MASTER lifecycle adds remain valid because session-only characters are
 * an intentional feature. Automatic bootstrap adds are different: they must be
 * members of the current session's Creation/runtime configuration. This keeps
 * stale browser/appState data from ever crossing campaign boundaries.
 */
export class SessionActor extends BaseSessionActor {
  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);
    const bootstrapAdd = parseBootstrapCharacterAdd(raw);

    if (!bootstrapAdd) {
      await super.webSocketMessage(webSocket, message);
      return;
    }

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
