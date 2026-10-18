import { SessionActor as BaseSessionActor } from "./BootstrapGuardSessionActor";
import type { SessionConnection } from "./protocol";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";
import { readRuntimeConfig } from "./runtimeConfigAccess";
import {
  broadcastAllVisibleCharacterSnapshots,
  broadcastVisibilityFiltered,
  refreshConnectionVisibility,
} from "./visibilityDelivery";

const ABILITIES_STATE_KEY = "abilities-state";
const HP_STATE_KEY = "hp-state";
const CONDITIONS_STATE_KEY = "conditions-state";
const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";
const INITIATIVE_STATE_KEY = "initiative-state";
const PURGED_CHARACTERS_STATE_KEY = "purged-character-ids-v1";
const CLOSE_CODE_KICKED = 4002;

type PurgedCharacterMarker = {
  purgedAt: number;
  purgedAtCreationRevision: number;
};

type PurgedCharacterState = Record<string, PurgedCharacterMarker>;

type AdministrationOperation =
  | { type: "character.session.purge"; characterId: string }
  | { type: "session.member.kick"; userId: string };

type CharacterAdd = {
  characterId: string;
  origin?: "bootstrap";
};

/**
 * Final administrative boundary for destructive session operations.
 *
 * Purge is intentionally different from character.session.remove: remove keeps
 * an inactive snapshot so the MASTER can reactivate it later, while purge
 * deletes the preserved session copy. Member kick is likewise stronger than a
 * membership database change because it immediately closes the member's live
 * sockets and inactivates their session characters.
 */
export class SessionActor extends BaseSessionActor {
  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);

    const administrationOperation = parseAdministrationOperation(raw);
    if (administrationOperation) {
      const connection = readConnection(webSocket);
      if (!connection) {
        webSocket.close(1011, "Missing connection attachment");
        return;
      }
      if (connection.role !== "MASTER") {
        sendError(
          webSocket,
          "MASTER_REQUIRED",
          "Only the MASTER can kick session members or permanently purge characters.",
        );
        return;
      }

      if (administrationOperation.type === "character.session.purge") {
        await this.purgeInactiveCharacter(
          webSocket,
          administrationOperation.characterId,
        );
      } else {
        await this.kickMember(
          webSocket,
          connection,
          administrationOperation.userId,
        );
      }
      return;
    }

    const add = parseCharacterAdd(raw);
    if (add) {
      const markers = await this.readPurgedCharacterState();
      const marker = markers[add.characterId];
      if (marker) {
        if (add.origin === "bootstrap") {
          const runtimeConfig = await readRuntimeConfig(this.ctx.storage);
          const intentionallyReadded = Boolean(
            runtimeConfig
            && runtimeConfig.creationRevision > marker.purgedAtCreationRevision
            && runtimeConfig.config.characters.some(
              (character) => character.characterId === add.characterId,
            ),
          );
          if (!intentionallyReadded) {
            sendError(
              webSocket,
              "PURGED_CHARACTER_REQUIRES_READD",
              "This character was permanently removed from the session and must be explicitly added again before bootstrap can restore it.",
            );
            return;
          }
        }

        delete markers[add.characterId];
        await this.ctx.storage.put(PURGED_CHARACTERS_STATE_KEY, markers);
      }
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async purgeInactiveCharacter(
    webSocket: WebSocket,
    characterId: string,
  ): Promise<void> {
    const [lifecycle, abilities, hp, conditions, markers, runtimeConfig, initiative] =
      await Promise.all([
        this.ctx.storage
          .get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)
          .then((value) => value ?? {}),
        this.ctx.storage
          .get<Record<string, unknown>>(ABILITIES_STATE_KEY)
          .then((value) => value ?? {}),
        this.ctx.storage
          .get<Record<string, unknown>>(HP_STATE_KEY)
          .then((value) => value ?? {}),
        this.ctx.storage
          .get<Record<string, unknown>>(CONDITIONS_STATE_KEY)
          .then((value) => value ?? {}),
        this.readPurgedCharacterState(),
        readRuntimeConfig(this.ctx.storage),
        this.ctx.storage.get<Record<string, unknown>>(INITIATIVE_STATE_KEY),
      ]);

    const current = lifecycle[characterId];
    if (!current) {
      sendError(
        webSocket,
        "SESSION_CHARACTER_NOT_FOUND",
        "The character is not preserved in this session.",
      );
      return;
    }
    if (current.active) {
      sendError(
        webSocket,
        "SESSION_CHARACTER_STILL_ACTIVE",
        "Only inactive characters can be permanently removed. Kick or inactivate the character first.",
      );
      return;
    }

    delete lifecycle[characterId];
    delete abilities[characterId];
    delete hp[characterId];
    delete conditions[characterId];
    markers[characterId] = {
      purgedAt: Date.now(),
      purgedAtCreationRevision: runtimeConfig?.creationRevision ?? 0,
    };

    const initiativeResult = removeCharacterFromInitiative(initiative, characterId);
    const writes: Record<string, unknown> = {
      [CHARACTER_LIFECYCLE_STATE_KEY]: lifecycle,
      [ABILITIES_STATE_KEY]: abilities,
      [HP_STATE_KEY]: hp,
      [CONDITIONS_STATE_KEY]: conditions,
      [PURGED_CHARACTERS_STATE_KEY]: markers,
    };
    if (initiativeResult.changed && initiativeResult.state) {
      writes[INITIATIVE_STATE_KEY] = initiativeResult.state;
    }
    await this.ctx.storage.put(writes);

    const sockets = this.ctx.getWebSockets();
    for (const socket of sockets) {
      refreshConnectionVisibility(socket, runtimeConfig, lifecycle);
    }
    await broadcastAllVisibleCharacterSnapshots(this.ctx.storage, sockets);
    if (initiativeResult.changed && initiativeResult.state) {
      broadcastVisibilityFiltered(sockets, {
        type: "session.initiative.updated",
        state: initiativeResult.state,
      });
    }
  }

  private async kickMember(
    webSocket: WebSocket,
    connection: SessionConnection,
    userId: string,
  ): Promise<void> {
    if (userId === connection.userId) {
      sendError(
        webSocket,
        "MASTER_CANNOT_KICK_SELF",
        "The session MASTER cannot kick their own connection.",
      );
      return;
    }

    const lifecycle = await this.ctx.storage
      .get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)
      .then((value) => value ?? {});
    const ownedCharacterIds = Object.values(lifecycle)
      .filter((character) =>
        character.active
        && character.ownerUserId?.trim() === userId,
      )
      .map((character) => character.characterId);

    // Use the normal lifecycle path so each removed character keeps the same
    // validation, log entry, reverse operation and broadcasts as a manual kick.
    for (const characterId of ownedCharacterIds) {
      await super.webSocketMessage(
        webSocket,
        JSON.stringify({
          type: "session.character.operation",
          operation: {
            type: "character.session.remove",
            characterId,
          },
        }),
      );
    }

    for (const socket of this.ctx.getWebSockets()) {
      const target = readConnection(socket);
      if (target?.userId !== userId) continue;
      try {
        socket.close(CLOSE_CODE_KICKED, "Removed from session by MASTER");
      } catch {}
    }
  }

  private async readPurgedCharacterState(): Promise<PurgedCharacterState> {
    return this.ctx.storage
      .get<PurgedCharacterState>(PURGED_CHARACTERS_STATE_KEY)
      .then((value) => value ?? {});
  }
}

function parseAdministrationOperation(raw: string): AdministrationOperation | null {
  const operation = readLifecycleOperation(raw);
  if (!operation || typeof operation.type !== "string") return null;

  if (
    operation.type === "character.session.purge"
    && typeof operation.characterId === "string"
    && operation.characterId.trim()
  ) {
    return {
      type: "character.session.purge",
      characterId: operation.characterId.trim(),
    };
  }

  if (
    operation.type === "session.member.kick"
    && operation.characterId === "session"
    && typeof operation.userId === "string"
    && operation.userId.trim()
  ) {
    return {
      type: "session.member.kick",
      userId: operation.userId.trim(),
    };
  }

  return null;
}

function parseCharacterAdd(raw: string): CharacterAdd | null {
  const operation = readLifecycleOperation(raw);
  if (
    !operation
    || operation.type !== "character.session.add"
    || typeof operation.characterId !== "string"
    || !operation.characterId.trim()
  ) {
    return null;
  }

  return {
    characterId: operation.characterId.trim(),
    origin: operation.origin === "bootstrap" ? "bootstrap" : undefined,
  };
}

function readLifecycleOperation(raw: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.type !== "session.character.operation") return null;
  return isRecord(value.operation) ? value.operation : null;
}

function removeCharacterFromInitiative(
  value: Record<string, unknown> | undefined,
  characterId: string,
): { changed: boolean; state?: Record<string, unknown> } {
  if (!value || !isRecord(value.session)) return { changed: false, state: value };
  const session = value.session;
  if (!Array.isArray(session.entries)) return { changed: false, state: value };

  const removedEntryIds = new Set<string>();
  const entries = session.entries.filter((entry) => {
    if (!isRecord(entry)) return true;
    const matches =
      entry.sourceType === "character"
      && entry.sourceId === characterId;
    if (matches && typeof entry.id === "string") removedEntryIds.add(entry.id);
    return !matches;
  });
  if (entries.length === session.entries.length) {
    return { changed: false, state: value };
  }

  const activeEntryId = typeof session.activeEntryId === "string"
    ? session.activeEntryId
    : undefined;
  const roundAnchorEntryId = typeof session.roundAnchorEntryId === "string"
    ? session.roundAnchorEntryId
    : undefined;
  const nextActiveEntryId = activeEntryId && !removedEntryIds.has(activeEntryId)
    ? activeEntryId
    : undefined;
  const nextRoundAnchorEntryId =
    roundAnchorEntryId && !removedEntryIds.has(roundAnchorEntryId)
      ? roundAnchorEntryId
      : undefined;

  return {
    changed: true,
    state: {
      ...value,
      revision: finiteNumber(value.revision) + 1,
      session: {
        ...session,
        entries: entries.map((entry, index) =>
          isRecord(entry) ? { ...entry, order: index } : entry,
        ),
        activeEntryId: nextActiveEntryId,
        roundAnchorEntryId: nextRoundAnchorEntryId,
        started: Boolean(session.started && nextActiveEntryId && entries.length > 0),
        updatedAt: Date.now(),
      },
    },
  };
}

function finiteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function readConnection(socket: WebSocket): SessionConnection | null {
  try {
    const connection = socket.deserializeAttachment() as SessionConnection | null;
    return connection && typeof connection.userId === "string" ? connection : null;
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
