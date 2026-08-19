import type { CharacterProfile, CharacterRelationship } from "../../src/models/characters/characterProfile";

export type SessionProfileOperation = {
  type: "character.profile.replace";
  characterId: string;
  profile: CharacterProfile;
};

export type SessionProfileClientMessage = {
  type: "session.profile.operation";
  operation: SessionProfileOperation;
};

const ALIGNMENTS = new Set([
  "lawful-good", "neutral-good", "chaotic-good",
  "lawful-neutral", "true-neutral", "chaotic-neutral",
  "lawful-evil", "neutral-evil", "chaotic-evil", "unaligned",
]);

export function parseProfileClientMessage(raw: string): SessionProfileClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "session.profile.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (operation.type !== "character.profile.replace" || typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;
  if (!isProfile(operation.profile)) return null;
  return message as SessionProfileClientMessage;
}

function isProfile(value: unknown): value is CharacterProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  if (typeof profile.traits !== "string" || typeof profile.history !== "string" || typeof profile.physicalAppearance !== "string") return false;
  if (profile.alignment !== undefined && (typeof profile.alignment !== "string" || !ALIGNMENTS.has(profile.alignment))) return false;
  if (profile.imageUrl !== undefined && typeof profile.imageUrl !== "string") return false;
  if (!Array.isArray(profile.relationships) || !profile.relationships.every(isRelationship)) return false;
  return true;
}

function isRelationship(value: unknown): value is CharacterRelationship {
  if (!value || typeof value !== "object") return false;
  const relationship = value as Record<string, unknown>;
  return typeof relationship.id === "string" && relationship.id.trim().length > 0
    && typeof relationship.name === "string"
    && typeof relationship.relation === "string"
    && (relationship.description === undefined || typeof relationship.description === "string");
}
