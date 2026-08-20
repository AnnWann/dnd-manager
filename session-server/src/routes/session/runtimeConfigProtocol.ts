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

  return config.characters.every(isCharacterConfig);
}

function isCharacterConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const character = value as Record<string, unknown>;
  return (
    typeof character.characterId === "string"
    && character.characterId.trim().length > 0
    && typeof character.ownerId === "string"
    && character.ownerId.trim().length > 0
    && typeof character.type === "string"
    && (character.visibility === "private"
      || character.visibility === "party"
      || character.visibility === "master")
    && typeof character.unique === "boolean"
    && Array.isArray(character.customSystems)
  );
}
