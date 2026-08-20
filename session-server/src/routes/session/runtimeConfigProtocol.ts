import type { SessionRuntimeConfigSnapshot } from "../../../../src/shared/session-runtime/sessionRuntimeConfig";

export type SessionRuntimeConfigPublishMessage = {
  type: "session.config.publish";
  snapshot: SessionRuntimeConfigSnapshot;
};

export type SessionRuntimeConfigSnapshotMessage = {
  type: "session.config.snapshot";
  snapshot: SessionRuntimeConfigSnapshot | null;
};

export function parseRuntimeConfigPublishMessage(
  raw: string,
): SessionRuntimeConfigPublishMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "session.config.publish") return null;
  if (!isRuntimeConfigSnapshot(message.snapshot)) return null;

  return {
    type: "session.config.publish",
    snapshot: message.snapshot,
  };
}

function isRuntimeConfigSnapshot(
  value: unknown,
): value is SessionRuntimeConfigSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (
    !Number.isInteger(snapshot.creationRevision)
    || Number(snapshot.creationRevision) < 1
    || !snapshot.config
    || typeof snapshot.config !== "object"
    || Array.isArray(snapshot.config)
  ) {
    return false;
  }

  const config = snapshot.config as Record<string, unknown>;
  if (
    !Array.isArray(config.characters)
    || !Array.isArray(config.spells)
    || !Array.isArray(config.customSystems)
  ) {
    return false;
  }

  if (!config.characters.every(isCharacterConfig)) return false;
  if (!config.spells.every(isSpellConfig)) return false;
  if (!config.customSystems.every(isCustomSystemConfig)) return false;

  const characterIds = config.characters.map((entry) =>
    (entry as Record<string, unknown>).characterId as string,
  );
  const spellIds = config.spells.map((entry) =>
    (entry as Record<string, unknown>).index as string,
  );
  const systemIds = config.customSystems.map((entry) =>
    (entry as Record<string, unknown>).id as string,
  );

  return unique(characterIds) && unique(spellIds) && unique(systemIds);
}

function isCharacterConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const character = value as Record<string, unknown>;
  return (
    nonEmpty(character.characterId)
    && nonEmpty(character.ownerId)
    && nonEmpty(character.type)
    && (character.visibility === "private"
      || character.visibility === "party"
      || character.visibility === "master")
    && typeof character.unique === "boolean"
    && Array.isArray(character.customSystems)
    && character.customSystems.every(isCharacterCustomSystemConfig)
  );
}

function isCharacterCustomSystemConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const system = value as Record<string, unknown>;
  return (
    nonEmpty(system.systemId)
    && Number.isInteger(system.systemVersion)
    && Number(system.systemVersion) >= 1
    && typeof system.enabled === "boolean"
  );
}

function isSpellConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const spell = value as Record<string, unknown>;
  return nonEmpty(spell.index) && nonEmpty(spell.name);
}

function isCustomSystemConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const system = value as Record<string, unknown>;
  return nonEmpty(system.id) && nonEmpty(system.name);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}
