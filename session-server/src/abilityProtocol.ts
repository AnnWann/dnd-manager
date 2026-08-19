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
      activationOptionId?: string;
    }
  | {
      type: "character.ability.restore";
      characterId: string;
      source: SessionAbilitySource;
    }
  | {
      type: "character.ability.deactivate";
      characterId: string;
      source: SessionAbilitySource;
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

  switch (value.type) {
    case "character.ability.use":
      return isAbilitySource(value.source) &&
        (value.activationOptionId === undefined || typeof value.activationOptionId === "string");
    case "character.ability.restore":
    case "character.ability.deactivate":
      return isAbilitySource(value.source);
    case "character.ability.save":
      return isRecord(value.ability) && typeof value.ability.id === "string" && typeof value.ability.name === "string";
    case "character.ability.remove":
      return typeof value.abilityId === "string" && value.abilityId.trim().length > 0;
    default:
      return false;
  }
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
