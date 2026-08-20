import type {
  SessionRuntimeCharacterConfig,
  SessionRuntimeConfigSnapshot,
} from "../../../../src/shared/session-runtime/sessionRuntimeConfig";
import type { SessionConnection } from "./protocol";

export const RUNTIME_CONFIG_STATE_KEY = "runtime-config-state";

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

  if (!snapshot) {
    return {
      ok: false,
      code: "RUNTIME_CONFIG_NOT_INITIALIZED",
      message: "The MASTER must publish the saved Creation configuration before players can change character state.",
    };
  }

  const character = getRuntimeCharacterConfig(snapshot, characterId);
  if (!character) {
    return {
      ok: false,
      code: "CHARACTER_NOT_IN_CREATION",
      message: "This character is not part of the active Creation configuration.",
    };
  }

  if (character.ownerId !== connection.userId) {
    return {
      ok: false,
      code: "CHARACTER_ACCESS_DENIED",
      message: "You cannot change a character owned by another player.",
    };
  }

  return { ok: true, character };
}

export function canViewRuntimeCharacter(
  connection: SessionConnection,
  character: SessionRuntimeCharacterConfig,
): boolean {
  if (connection.role === "MASTER") return true;
  if (character.ownerId === connection.userId) return true;
  return character.visibility === "party";
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
    return typeof characterId === "string" && characterId.trim()
      ? characterId.trim()
      : null;
  } catch {
    return null;
  }
}
