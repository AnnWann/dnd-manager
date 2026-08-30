import type { AbilityResourceSelection } from "../../../../../src/models/abilities/Ability";
import type { BonusRollResolution } from "../../../../../src/models/bonuses/Bonus";
import {
  DAMAGE_TYPES,
  type DamageAffinity,
} from "../../../../../src/models/combat/Damage";

export type SessionAbilitySource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }
  | { type: "condition"; conditionId: string; abilityId: string };

export type SessionAbilitySeed = {
  characterId: string;
  character: Record<string, unknown>;
};

export type SessionAbilityState = {
  characterId: string;
  character: Record<string, unknown>;
  initialized: true;
  revision: number;
};

export type SessionAbilityOperation =
  | {
      type: "character.ability.use";
      characterId: string;
      source: SessionAbilitySource;
      abilityName?: string;
      activationOptionId?: string;
      resourceSelection?: AbilityResourceSelection;
      bonusRollValues?: Record<string, number>;
      bonusRollResults?: BonusRollResolution[];
    }
  | {
      type: "character.ability.usage.spend";
      characterId: string;
      source: SessionAbilitySource;
      abilityName?: string;
    }
  | {
      type: "character.ability.restore";
      characterId: string;
      source: SessionAbilitySource;
      abilityName?: string;
    }
  | {
      type: "character.ability.deactivate";
      characterId: string;
      source: SessionAbilitySource;
      abilityName?: string;
    }
  | {
      type: "character.ability.save";
      characterId: string;
      ability: Record<string, unknown>;
    }
  | {
      type: "character.ability.remove";
      characterId: string;
      abilityId: string;
      abilityName?: string;
    }
  | {
      type: "character.damageAffinities.set";
      characterId: string;
      damageAffinities: DamageAffinity[];
    };

export type SessionAbilityClientMessage =
  | { type: "session.abilities.initialize"; characters: SessionAbilitySeed[] }
  | { type: "session.abilities.operation"; operation: SessionAbilityOperation };

export type SessionAbilityServerMessage =
  | { type: "session.abilities.snapshot"; characters: SessionAbilityState[] }
  | { type: "session.abilities.updated"; character: SessionAbilityState };

export function parseAbilityClientMessage(raw: string): SessionAbilityClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") return null;

  if (parsed.type === "session.abilities.initialize" && Array.isArray(parsed.characters)) {
    const characters = parsed.characters.filter(isAbilitySeed);
    if (characters.length !== parsed.characters.length) return null;
    return { type: "session.abilities.initialize", characters };
  }

  if (parsed.type === "session.abilities.operation" && isAbilityOperation(parsed.operation)) {
    return { type: "session.abilities.operation", operation: parsed.operation };
  }

  return null;
}

function isAbilitySeed(value: unknown): value is SessionAbilitySeed {
  return (
    isRecord(value) &&
    typeof value.characterId === "string" &&
    value.characterId.trim().length > 0 &&
    isRecord(value.character)
  );
}

function isAbilityOperation(value: unknown): value is SessionAbilityOperation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.characterId !== "string") {
    return false;
  }

  const hasValidOptionalName =
    value.abilityName === undefined || isAbilityName(value.abilityName);

  switch (value.type) {
    case "character.ability.use":
      return isAbilitySource(value.source) &&
        hasValidOptionalName &&
        (value.activationOptionId === undefined || typeof value.activationOptionId === "string") &&
        (value.resourceSelection === undefined || isResourceSelection(value.resourceSelection)) &&
        (value.bonusRollValues === undefined || isFiniteNumberRecord(value.bonusRollValues));
    case "character.ability.usage.spend":
    case "character.ability.restore":
    case "character.ability.deactivate":
      return isAbilitySource(value.source) && hasValidOptionalName;
    case "character.ability.save":
      return isRecord(value.ability) && typeof value.ability.id === "string" && typeof value.ability.name === "string";
    case "character.ability.remove":
      return typeof value.abilityId === "string" && value.abilityId.trim().length > 0 && hasValidOptionalName;
    case "character.damageAffinities.set":
      return Array.isArray(value.damageAffinities) && value.damageAffinities.every(isDamageAffinity);
    default:
      return false;
  }
}

function isDamageAffinity(value: unknown): value is DamageAffinity {
  if (!isRecord(value)) return false;
  if (!DAMAGE_TYPES.includes(value.damageType as DamageAffinity["damageType"])) return false;
  if (value.kind !== "resistance" && value.kind !== "immunity" && value.kind !== "vulnerability") return false;
  if (value.qualifier !== undefined && value.qualifier !== "any" && value.qualifier !== "magical" && value.qualifier !== "nonmagical") return false;
  return value.label === undefined || typeof value.label === "string";
}

function isResourceSelection(value: unknown): value is AbilityResourceSelection {
  if (!isRecord(value)) return false;
  if (value.activationLevel !== undefined && (!Number.isInteger(value.activationLevel) || value.activationLevel < 1 || value.activationLevel > 9)) {
    return false;
  }
  if (value.alternatives !== undefined) {
    if (!isRecord(value.alternatives)) return false;
    for (const [groupId, costId] of Object.entries(value.alternatives)) {
      if (!groupId.trim() || typeof costId !== "string" || !costId.trim()) return false;
    }
  }
  return true;
}

function isFiniteNumberRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, candidate]) => key.trim().length > 0 && typeof candidate === "number" && Number.isFinite(candidate),
  );
}

function isAbilityName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

function isAbilitySource(value: unknown): value is SessionAbilitySource {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.abilityId !== "string") {
    return false;
  }

  if (value.type === "character" || value.type === "race") return true;
  if (value.type === "equipment") return typeof value.itemId === "string" && value.itemId.trim().length > 0;
  if (value.type === "condition") return typeof value.conditionId === "string" && value.conditionId.trim().length > 0;
  return false;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
