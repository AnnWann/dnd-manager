import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";
import type { SessionConnection } from "./protocol";
import { reconcileSessionSupplyProjection } from "./supplyProjection";

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
  /** Ephemeral projection of characters owned by this user in characters-state. */
  ownedCharacterIds?: string[];
  /** Runtime-config visibility kept separate so ownership changes can be applied synchronously. */
  partyVisibleCharacterIds?: string[];
  /** Signed campaign capability; MODERATOR and MASTER have this capability. */
  canReadAnyCharacter?: boolean;
  /** Signed campaign capability; retained on the attachment for mutation authorization. */
  canWriteAnyCharacter?: boolean;
};

export function refreshConnectionVisibility(
  socket: WebSocket,
  snapshot: SessionRuntimeConfigSnapshot | null,
  lifecycleState?: Record<string, SessionCharacterLifecycleState>,
): void {
  const connection = readConnection(socket) as OwnershipAwareSessionConnection | null;
  if (!connection) return;

  if (canReadEveryCharacter(connection)) {
    connection.runtimeConfigRevision = snapshot?.creationRevision;
    delete connection.ownedCharacterIds;
    delete connection.partyVisibleCharacterIds;
    delete connection.visibleCharacterIds;
    socket.serializeAttachment(connection);
    return;
  }

  if (lifecycleState !== undefined) {
    connection.ownedCharacterIds = deriveOwnedCharacterIds(
      connection.userId,
      lifecycleState,
    );
  }

  connection.partyVisibleCharacterIds = snapshot
    ? snapshot.config.characters
        .filter((character) => character.visibility === "party")
        .map((character) => character.characterId)
    : [];
  connection.runtimeConfigRevision = snapshot?.creationRevision;
  recomputeVisibleCharacterIds(connection);
  socket.serializeAttachment(connection);
}

export function refreshAllConnectionVisibility(
  sockets: WebSocket[],
  snapshot: SessionRuntimeConfigSnapshot | null,
): void {
  for (const socket of sockets) refreshConnectionVisibility(socket, snapshot);
}

export function sendVisibilityFiltered(socket: WebSocket, message: unknown): void {
  const lifecycleDelivery = transformLifecycleVisibilityMessage(socket, message);
  if (lifecycleDelivery.handled) {
    if (lifecycleDelivery.message === null) return;
    try { socket.send(JSON.stringify(lifecycleDelivery.message)); } catch {}
    return;
  }

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

  const supplyProjection = await reconcileSessionSupplyProjection(storage);
  if (supplyProjection.state) {
    sendVisibilityFiltered(socket, {
      type: "session.inventory.snapshot",
      state: supplyProjection.state,
    });
  }

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

          sendVisibilityFiltered(target, message);
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as WebSocket;
}

function transformLifecycleVisibilityMessage(
  socket: WebSocket,
  message: unknown,
): { handled: boolean; message: unknown | null } {
  const connection = readConnection(socket) as OwnershipAwareSessionConnection | null;
  if (!connection || canReadEveryCharacter(connection)) {
    return { handled: false, message };
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { handled: false, message };
  }

  const record = message as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (type !== "session.character.updated" && type !== "session.character.removed") {
    return { handled: false, message };
  }

  const characterId = type === "session.character.removed"
    ? (typeof record.characterId === "string" ? record.characterId.trim() : "")
    : readCharacterId(record.character) ?? "";
  if (!characterId) return { handled: true, message: null };

  const wasVisible = canReceiveCharacter(connection, characterId);
  const ownedCharacterIds = new Set(readOwnedCharacterIds(connection) ?? []);

  if (type === "session.character.removed") {
    ownedCharacterIds.delete(characterId);
  } else {
    const character = record.character as Record<string, unknown>;
    const ownerUserId = typeof character.ownerUserId === "string"
      ? character.ownerUserId.trim()
      : "";
    const active = character.active !== false;
    if (active && ownerUserId === connection.userId) {
      ownedCharacterIds.add(characterId);
    } else {
      ownedCharacterIds.delete(characterId);
    }
  }

  connection.ownedCharacterIds = [...ownedCharacterIds];
  recomputeVisibleCharacterIds(connection);
  socket.serializeAttachment(connection);

  const isVisible = canReceiveCharacter(connection, characterId);
  if (type === "session.character.removed") {
    return { handled: true, message: wasVisible ? message : null };
  }
  if (wasVisible && !isVisible) {
    return {
      handled: true,
      message: { type: "session.character.removed", characterId },
    };
  }
  return { handled: true, message: isVisible ? message : null };
}

function filterMessageForSocket(socket: WebSocket, message: unknown): unknown | null {
  const connection = readConnection(socket) as OwnershipAwareSessionConnection | null;
  if (!connection || canReadEveryCharacter(connection)) return message;
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

function deriveOwnedCharacterIds(
  userId: string,
  lifecycleState: Record<string, SessionCharacterLifecycleState>,
): string[] {
  return Object.values(lifecycleState)
    .filter((character) =>
      character.active
      && character.ownerUserId?.trim() === userId,
    )
    .map((character) => character.characterId);
}

function recomputeVisibleCharacterIds(
  connection: OwnershipAwareSessionConnection,
): void {
  connection.visibleCharacterIds = Array.from(new Set([
    ...(connection.ownedCharacterIds ?? []),
    ...(connection.partyVisibleCharacterIds ?? []),
  ]));
}

function canReceiveCharacter(
  connection: SessionConnection,
  characterId: string,
): boolean {
  if (canReadEveryCharacter(connection as OwnershipAwareSessionConnection)) return true;
  return connection.visibleCharacterIds?.includes(characterId) ?? false;
}

function canReadEveryCharacter(
  connection: OwnershipAwareSessionConnection,
): boolean {
  return connection.role === "MASTER" || connection.canReadAnyCharacter === true;
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
