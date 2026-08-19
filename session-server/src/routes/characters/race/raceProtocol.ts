import type { CharacterRace } from "../../src/models/races/CharacterRace";
import type { SkillProficiency } from "../../src/models/sheet/Skills";

export type SessionRaceOperation = {
  type: "character.race.replace";
  characterId: string;
  race: CharacterRace;
  skills: Record<string, SkillProficiency>;
  savingThrowProficiencies: Record<string, boolean>;
};

export type SessionRaceClientMessage = {
  type: "session.race.operation";
  operation: SessionRaceOperation;
};

export function parseRaceClientMessage(raw: string): SessionRaceClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "session.race.operation" || !message.operation || typeof message.operation !== "object") return null;
  const operation = message.operation as Record<string, unknown>;
  if (operation.type !== "character.race.replace" || typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;
  if (!isRecord(operation.race) || !isRecord(operation.skills) || !isRecord(operation.savingThrowProficiencies)) return null;
  return message as SessionRaceClientMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
