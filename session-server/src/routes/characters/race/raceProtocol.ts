import type { CharacterRace } from "../../src/models/races/CharacterRace";
import type { SkillProficiency } from "../../src/models/sheet/Skills";

export type SessionRaceOperation =
  | {
      type: "character.race.replace";
      characterId: string;
      race: CharacterRace;
      skills: Record<string, SkillProficiency>;
      savingThrowProficiencies: Record<string, boolean>;
    }
  | {
      type: "character.race.spells.replace";
      characterId: string;
      racialSpells: Record<string, unknown>[];
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
  if (typeof operation.characterId !== "string" || !operation.characterId.trim()) return null;

  if (operation.type === "character.race.replace") {
    if (!isRecord(operation.race) || !isRecord(operation.skills) || !isRecord(operation.savingThrowProficiencies)) return null;
    return message as SessionRaceClientMessage;
  }

  if (operation.type === "character.race.spells.replace") {
    if (!Array.isArray(operation.racialSpells) || !operation.racialSpells.every(isRacialSpellEntry)) return null;
    return message as SessionRaceClientMessage;
  }

  return null;
}

function isRacialSpellEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isRecord(value.source) || value.source.type !== "race") return false;
  return isRecord(value.spells) && typeof value.spells.id === "string" && value.spells.id.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
