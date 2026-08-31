import type {
  SessionRuntimeCharacterConfig,
  SessionRuntimeConfigSnapshot,
} from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import type { SessionConnection } from "./protocol";

export const RUNTIME_CONFIG_STATE_KEY = "runtime-config-state";

type OwnershipAwareSessionConnection = SessionConnection & {
  /** Ephemeral projection of characters owned by this user in characters-state. */
  ownedCharacterIds?: string[];
};

export async function readRuntimeConfig(
  storage: DurableObjectStorage,
): Promise<SessionRuntimeConfigSnapshot | null> {
  return (
    await storage.get<SessionRuntimeConfigSnapshot>(RUNTIME_CONFIG_STATE_KEY)
  ) ?? null;
}

export function getRuntimeCharacterConfig(
  snapshot: SessionRuntimeConfigSnapshot | null,
  characterId: string,
): SessionRuntimeCharacterConfig | null {
  if (!snapshot) return null;
  return snapshot.config.characters.find(
    (character) => character.characterId === characterId,
  ) ?? null;
}

export function authorizeCharacterMutation(
  connection: SessionConnection,
  snapshot: SessionRuntimeConfigSnapshot | null,
  characterId: string,
): { ok: true; character: SessionRuntimeCharacterConfig | null } | { ok: false; code: string; message: string } {
  if (connection.role === "MASTER") {
    return {
      ok: true,
      character: getRuntimeCharacterConfig(snapshot, characterId),
    };
  }

  const ownedCharacterIds = readOwnedCharacterIds(connection);
  if (ownedCharacterIds === undefined) {
    return {
      ok: false,
      code: "SESSION_OWNERSHIP_NOT_READY",
      message: "Authoritative session ownership has not been loaded for this connection yet.",
    };
  }

  if (!ownedCharacterIds.includes(characterId)) {
    return {
      ok: false,
      code: "CHARACTER_ACCESS_DENIED",
      message: "You cannot change a character owned by another player.",
    };
  }

  return {
    ok: true,
    character: getRuntimeCharacterConfig(snapshot, characterId),
  };
}

export function canViewRuntimeCharacter(
  connection: SessionConnection,
  character: SessionRuntimeCharacterConfig,
): boolean {
  if (connection.role === "MASTER") return true;

  const ownedCharacterIds = readOwnedCharacterIds(connection);
  if (ownedCharacterIds?.includes(character.characterId)) return true;
  return character.visibility === "party";
}

export function visibleRuntimeConfigSnapshot(
  connection: SessionConnection,
  snapshot: SessionRuntimeConfigSnapshot | null,
): SessionRuntimeConfigSnapshot | null {
  if (!snapshot || connection.role === "MASTER") return snapshot;
  return {
    creationRevision: snapshot.creationRevision,
    config: {
      ...snapshot.config,
      characters: snapshot.config.characters.filter((character) =>
        canViewRuntimeCharacter(connection, character),
      ),
      // Creature stat blocks and real names are MASTER rules data. Initiative
      // visibility sends only the public projection required by players.
      creatureCompendium: [],
    },
  };
}

export function findRuntimeSpell(
  snapshot: SessionRuntimeConfigSnapshot | null,
  spellIndex: string,
) {
  if (!snapshot) return undefined;
  return snapshot.config.spells.find((spell) => spell.index === spellIndex);
}

export function findRuntimeCustomSystem(
  snapshot: SessionRuntimeConfigSnapshot | null,
  systemId: string,
) {
  if (!snapshot) return undefined;
  return snapshot.config.customSystems.find((system) => system.id === systemId);
}

export function extractOperationCharacterId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const operation = value.operation;
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) return null;
    const characterId = (operation as Record<string, unknown>).characterId;
    if (typeof characterId !== "string") return null;
    const normalized = characterId.trim();
    if (!normalized || normalized === "session") return null;
    return normalized;
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
