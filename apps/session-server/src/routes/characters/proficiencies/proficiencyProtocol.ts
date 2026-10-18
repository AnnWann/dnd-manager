import type { Proficiency, ProficiencyCategory } from "../../../../../../src/models/sheet/Proficiency";

import type { SessionProficiencyOperation as SharedSessionProficiencyOperation, SessionProficiencyClientMessage as SharedSessionProficiencyClientMessage } from "../../../../../../packages/session-protocol/src/proficiencyOperations"
export type SessionProficiencyOperation = SharedSessionProficiencyOperation<Proficiency>;
export type SessionProficiencyClientMessage = SharedSessionProficiencyClientMessage<Proficiency>;

const CATEGORIES = new Set<ProficiencyCategory>([
  "armor", "shield", "weapon", "tool", "vehicle", "mount", "language",
  "instrument", "game", "skill", "saving-throw", "other",
]);

export function parseProficiencyClientMessage(raw: string): SessionProficiencyClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "session.proficiency.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (typeof operation.type !== "string" || typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;

  if (operation.type === "character.proficiency.add") {
    if (!isProficiency(operation.proficiency)) return null;
    return message as SessionProficiencyClientMessage;
  }
  if (operation.type === "character.proficiency.remove") {
    if (typeof operation.proficiencyId !== "string" || !operation.proficiencyId.trim()) return null;
    return message as SessionProficiencyClientMessage;
  }
  return null;
}

function isProficiency(value: unknown): value is Proficiency {
  if (!value || typeof value !== "object") return false;
  const proficiency = value as Record<string, unknown>;
  return typeof proficiency.id === "string" && proficiency.id.trim().length > 0
    && typeof proficiency.name === "string" && proficiency.name.trim().length > 0
    && typeof proficiency.category === "string" && CATEGORIES.has(proficiency.category as ProficiencyCategory)
    && (proficiency.notes === undefined || typeof proficiency.notes === "string")
    && (proficiency.expertise === undefined || typeof proficiency.expertise === "boolean");
}
