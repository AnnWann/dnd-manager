import type { CharacterBackground } from "../../../../../src/models/characters/CharacterBackground";
import type { CharacterProfile, CharacterRelationship } from "../../../../../src/models/characters/characterProfile";
import type { ProficiencyCategory } from "../../../../../src/models/sheet/Proficiency";

export type SessionProfileOperation =
  | {
      type: "character.profile.replace";
      characterId: string;
      profile: CharacterProfile;
    }
  | {
      type: "character.profile.background.save";
      characterId: string;
      background: CharacterBackground;
      addEquipment: boolean;
    }
  | {
      type: "character.profile.background.remove";
      characterId: string;
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
const SKILLS = new Set([
  "acrobatics", "arcana", "athletics", "animalHandling", "performance",
  "deception", "stealth", "history", "intimidation", "insight",
  "investigation", "medicine", "nature", "perception", "persuasion",
  "sleightOfHand", "religion", "survival",
]);
const PROFICIENCY_CATEGORIES = new Set<ProficiencyCategory>([
  "armor", "shield", "weapon", "tool", "vehicle", "mount", "language",
  "instrument", "game", "skill", "saving-throw", "other",
]);

export function parseProfileClientMessage(raw: string): SessionProfileClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "session.profile.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;

  if (operation.type === "character.profile.replace") {
    if (!isProfile(operation.profile)) return null;
    return message as SessionProfileClientMessage;
  }
  if (operation.type === "character.profile.background.save") {
    if (!isBackground(operation.background) || typeof operation.addEquipment !== "boolean") return null;
    return message as SessionProfileClientMessage;
  }
  if (operation.type === "character.profile.background.remove") {
    return message as SessionProfileClientMessage;
  }
  return null;
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

function isBackground(value: unknown): value is CharacterBackground {
  if (!value || typeof value !== "object") return false;
  const background = value as Record<string, unknown>;
  if (typeof background.id !== "string" || typeof background.name !== "string" || !background.name.trim()) return false;
  if (typeof background.description !== "string") return false;
  if (!Array.isArray(background.skillProficiencies) || !background.skillProficiencies.every((skill) => typeof skill === "string" && SKILLS.has(skill))) return false;
  if (!Array.isArray(background.proficiencies) || !background.proficiencies.every(isProficiency)) return false;
  if (!Array.isArray(background.startingEquipment) || !background.startingEquipment.every(isStartingItem)) return false;
  return true;
}

function isProficiency(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const proficiency = value as Record<string, unknown>;
  return typeof proficiency.id === "string" && proficiency.id.trim().length > 0
    && typeof proficiency.name === "string" && proficiency.name.trim().length > 0
    && typeof proficiency.category === "string" && PROFICIENCY_CATEGORIES.has(proficiency.category as ProficiencyCategory)
    && (proficiency.notes === undefined || typeof proficiency.notes === "string")
    && (proficiency.expertise === undefined || typeof proficiency.expertise === "boolean");
}

function isStartingItem(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const quantity = Number(item.quantity ?? 1);
  return typeof item.name === "string" && item.name.trim().length > 0
    && Number.isFinite(quantity) && quantity > 0;
}
