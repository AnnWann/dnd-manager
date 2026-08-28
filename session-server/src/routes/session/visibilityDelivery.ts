import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import type { SessionConnection } from "./protocol";
import { canViewRuntimeCharacter } from "./runtimeConfigAccess";

const CHARACTER_SNAPSHOT_TYPES = new Set([
  "session.hp.snapshot",
  "session.conditions.snapshot",
  "session.abilities.snapshot",
  "session.characters.snapshot",
]);

const CHARACTER_UPDATE_TYPES = new Set([
  "session.hp.updated",
  "session.conditions.updated",
  "session.abilities.updated",
  "session.character.updated",
]);

type OwnershipAwareSessionConnection = SessionConnection & {
  ownedCharacterIds?: string[];
};

export function refreshConnectionVisibility(
  socket: WebSocket,
  snapshot: SessionRuntimeConfigSnapshot | null,
): void {
  const connection = readConnection(socket);
  if (!connection) return;

  if (connection.role === "MASTER") {
    connection.runtimeConfigRevision = snapshot?.creationRevision;
    delete connection.visibleCharacterIds;
    socket.serializeAttachment(connection);
    return;
  }

  const ownedCharacterIds = readOwnedCharacterIds(connection) ?? [];
  const configuredCharacterIds = snapshot
    ? snapshot.config.characters
        .filter((character) => canViewRuntimeCharacter(connection, character))
        .map((character) => character.characterId)
    : [];

  connection.runtimeConfigRevision = snapshot?.creationRevision;
  connection.visibleCharacterIds = Array.from(new Set([
    ...ownedCharacterIds,
    ...configuredCharacterIds,
  ]));
  socket.serializeAttachment(connection);
}

export function refreshAllConnectionVisibility(
  sockets: WebSocket[],
  snapshot: SessionRuntimeConfigSnapshot | null,
): void {
  for (const socket of sockets) refreshConnectionVisibility(socket, snapshot);
}

export function sendVisibilityFiltered(socket: WebSocket, message: unknown): void {
  const filtered = filterMessageForSocket(socket, message);
  if (filtered === null) return;
  try { socket.send(JSON.stringify(filtered)); } catch {}
}

export function broadcastVisibilityFiltered(
  sockets: WebSocket[],
  message: unknown,
): void {
  for (const socket of sockets) sendVisibilityFiltered(socket, message);
}

export function createVisibilityFilteredContext<T extends DurableObjectState>(ctx: T): T {
  return new Proxy(ctx, {
    get(target, property, receiver) {
      if (property === "getWebSockets") {
        return () => target.getWebSockets().map(createVisibilityFilteredSocket);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export async function sendAllVisibleCharacterSnapshots(
  storage: DurableObjectStorage,
  socket: WebSocket,
): Promise<void> {
  const [hp, conditions, abilities, lifecycle] = await Promise.all([
    storage.get<Record<string, unknown>>("hp-state").then((value) => value ?? {}),
    storage.get<Record<string, unknown>>("conditions-state").then((value) => value ?? {}),
    storage.get<Record<string, unknown>>("abilities-state").then((value) => value ?? {}),
    storage.get<Record<string, unknown>>("characters-state").then((value) => value ?? {}),
  ]);

  sendVisibilityFiltered(socket, {
    type: "session.hp.snapshot",
    characters: Object.values(hp),
  });
  sendVisibilityFiltered(socket, {
    type: "session.conditions.snapshot",
    characters: Object.values(conditions),
  });
  sendVisibilityFiltered(socket, {
    type: "session.abilities.snapshot",
    characters: Object.values(abilities),
  });
  sendVisibilityFiltered(socket, {
    type: "session.characters.snapshot",
    characters: Object.values(lifecycle),
  });
}

export async function broadcastAllVisibleCharacterSnapshots(
  storage: DurableObjectStorage,
  sockets: WebSocket[],
): Promise<void> {
  await Promise.all(
    sockets.map((socket) => sendAllVisibleCharacterSnapshots(storage, socket)),
  );
}

function createVisibilityFilteredSocket(socket: WebSocket): WebSocket {
  return new Proxy(socket, {
    get(target, property) {
      if (property === "send") {
        return (payload: string | ArrayBuffer | ArrayBufferView) => {
          if (typeof payload !== "string") {
            try { target.send(payload); } catch {}
            return;
          }

          let message: unknown;
          try { message = JSON.parse(payload); }
          catch {
            try { target.send(payload); } catch {}
            return;
          }

          const filtered = filterMessageForSocket(target, message);
          if (filtered === null) return;
          try { target.send(JSON.stringify(filtered)); } catch {}
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as WebSocket;
}

function filterMessageForSocket(socket: WebSocket, message: unknown): unknown | null {
  const connection = readConnection(socket);
  if (!connection || connection.role === "MASTER") return message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return message;

  const record = message as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";

  if (CHARACTER_SNAPSHOT_TYPES.has(type) && Array.isArray(record.characters)) {
    return {
      ...record,
      characters: record.characters.filter((entry) => {
        const characterId = readCharacterId(entry);
        return characterId ? canReceiveCharacter(connection, characterId) : false;
      }),
    };
  }

  if (CHARACTER_UPDATE_TYPES.has(type)) {
    const characterId = readCharacterId(record.character);
    return characterId && canReceiveCharacter(connection, characterId)
      ? message
      : null;
  }

  if (
    (type === "session.initiative.snapshot" || type === "session.initiative.updated") &&
    record.state &&
    typeof record.state === "object" &&
    !Array.isArray(record.state)
  ) {
    return filterInitiativeMessageForPlayer(connection, record);
  }

  if (type === "session.character.removed") {
    const characterId = typeof record.characterId === "string"
      ? record.characterId
      : "";
    return characterId && canReceiveCharacter(connection, characterId)
      ? message
      : null;
  }

  return message;
}

function filterInitiativeMessageForPlayer(
  connection: SessionConnection,
  message: Record<string, unknown>,
): Record<string, unknown> {
  const state = message.state as Record<string, unknown>;
  const rawSession = state.session;
  if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) return message;
  const session = rawSession as Record<string, unknown>;
  if (!Array.isArray(session.entries)) return message;

  const visibility = session.deathSaveVisibility;
  const entries = session.entries.map((rawEntry) => {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return rawEntry;
    const entry = rawEntry as Record<string, unknown>;
    const realName = typeof entry.realName === "string" ? entry.realName.trim() : "";
    const basicName = typeof entry.basicName === "string" ? entry.basicName.trim() : "";
    const canonicalName = typeof entry.name === "string" ? entry.name.trim() : "";
    const customName = typeof entry.customName === "string" ? entry.customName.trim() : "";
    const revealRealName = entry.revealRealName === true;
    const publicName = customName || (revealRealName ? (realName || canonicalName) : (basicName || canonicalName));
    const sourceId = typeof entry.sourceId === "string" ? entry.sourceId.trim() : "";
    const ownsEntry = Boolean(sourceId && readOwnedCharacterIds(connection)?.includes(sourceId));
    const maySeeDeathSaves = visibility === "everyone" || (visibility === "owner" && ownsEntry);

    const filtered: Record<string, unknown> = {
      ...entry,
      name: publicName,
    };
    if (!revealRealName) delete filtered.realName;
    if (!maySeeDeathSaves) delete filtered.deathSaves;
    return filtered;
  });

  return {
    ...message,
    state: {
      ...state,
      session: {
        ...session,
        entries,
      },
    },
  };
}

function canReceiveCharacter(
  connection: SessionConnection,
  characterId: string,
): boolean {
  if (connection.role === "MASTER") return true;
  return connection.visibleCharacterIds?.includes(characterId) ?? false;
}

function readCharacterId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const characterId = (value as Record<string, unknown>).characterId;
  return typeof characterId === "string" && characterId.trim()
    ? characterId.trim()
    : null;
}

function readConnection(socket: WebSocket): SessionConnection | null {
  try {
    const value = socket.deserializeAttachment() as SessionConnection | null;
    return value && typeof value.userId === "string" ? value : null;
  } catch {
    return null;
  }
}

function readOwnedCharacterIds(
  connection: SessionConnection,
): string[] | undefined {
  const value = (connection as OwnershipAwareSessionConnection).ownedCharacterIds;
  return Array.isArray(value) ? value : undefined;
}
