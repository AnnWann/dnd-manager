import type { CharacterProfile, CharacterRelationship } from "../../src/models/characters/characterProfile";
import type { Itemmable } from "../../src/models/items/item";
import type { Proficiency, ProficiencyCategory } from "../../src/models/sheet/Proficiency";
import type { SkillProficiency } from "../../src/models/sheet/Skills";

export type SessionProfileOperation = {
  type: "character.profile.replace";
  characterId: string;
  profile: CharacterProfile;
  inventory: Itemmable[];
  skills: Record<string, SkillProficiency>;
  proficiencies: Proficiency[];
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
const SKILL_PROFICIENCIES = new Set(["none", "proficient", "expertise"]);
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
  if (operation.type !== "character.profile.replace" || typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;
  if (!isProfile(operation.profile)) return null;
  if (!Array.isArray(operation.inventory) || !operation.inventory.every(isItem)) return null;
  if (!isSkills(operation.skills)) return null;
  if (!Array.isArray(operation.proficiencies) || !operation.proficiencies.every(isProficiency)) return null;
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

function isItem(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.trim().length > 0
    && typeof item.name === "string" && item.name.trim().length > 0;
}

function isSkills(value: unknown): value is Record<string, SkillProficiency> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === "string" && SKILL_PROFICIENCIES.has(entry),
  );
}

function isProficiency(value: unknown): value is Proficiency {
  if (!value || typeof value !== "object") return false;
  const proficiency = value as Record<string, unknown>;
  return typeof proficiency.id === "string" && proficiency.id.trim().length > 0
    && typeof proficiency.name === "string" && proficiency.name.trim().length > 0
    && typeof proficiency.category === "string" && PROFICIENCY_CATEGORIES.has(proficiency.category as ProficiencyCategory)
    && (proficiency.notes === undefined || typeof proficiency.notes === "string")
    && (proficiency.expertise === undefined || typeof proficiency.expertise === "boolean");
}
