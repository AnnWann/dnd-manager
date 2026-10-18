import type {
  SessionAttribute,
  SessionAttributesState,
  SessionAuthoritativeOperation,
  SessionConnection,
  SessionDieSides,
  SessionHpLogRecord,
  SessionHpSeed,
  SessionHpState,
  SessionReverseOperation,
  SessionRestOperation,
  SessionSavingThrowsState,
  SessionSkillsState,
  SessionStatOperation,
  SessionStatsState,
} from "../../session/protocol";

export const MAX_CHARACTER_STATE_LOG_RECORDS = 100;
/** @deprecated Use MAX_CHARACTER_STATE_LOG_RECORDS. */
export const MAX_HP_LOG_RECORDS = MAX_CHARACTER_STATE_LOG_RECORDS;

export type CharacterStateApplyResult =
  | { ok: true; next: SessionHpState; record: SessionHpLogRecord }
  | { ok: false; code: string; message: string };
/** @deprecated Use CharacterStateApplyResult. */
export type HpApplyResult = CharacterStateApplyResult;

export function defaultStats(): SessionStatsState {
  return {
    armorClassAdjustment: 0,
    initiativeAdjustment: 0,
    mobilityAdjustment: 0,
    passivePerceptionAdjustment: 0,
    exhaustion: 0,
    inspiration: false,
    experience: 0,
  };
}

export function defaultAttributes(): SessionAttributesState {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

export function defaultSavingThrows(): SessionSavingThrowsState {
  return { str: false, dex: false, con: false, int: false, wis: false, cha: false };
}

export function defaultSkills(): SessionSkillsState {
  return {
    acrobatics: "none",
    arcana: "none",
    athletics: "none",
    animalHandling: "none",
    performance: "none",
    deception: "none",
    stealth: "none",
    history: "none",
    intimidation: "none",
    insight: "none",
    investigation: "none",
    medicine: "none",
    nature: "none",
    perception: "none",
    persuasion: "none",
    sleightOfHand: "none",
    religion: "none",
    survival: "none",
  };
}

export function normalizeStatsSeed(stats: SessionStatsState | undefined): SessionStatsState {
  if (!stats) return defaultStats();
  return {
    armorClassAdjustment: finite(stats.armorClassAdjustment),
    initiativeAdjustment: finite(stats.initiativeAdjustment),
    mobilityAdjustment: finite(stats.mobilityAdjustment),
    passivePerceptionAdjustment: finite(stats.passivePerceptionAdjustment),
    exhaustion: clamp(integer(stats.exhaustion), 0, 6),
    inspiration: Boolean(stats.inspiration),
    experience: Math.max(0, integer(stats.experience)),
  };
}

export function normalizeAttributesSeed(attributes: SessionAttributesState | undefined): SessionAttributesState {
  if (!attributes) return defaultAttributes();
  return {
    str: clamp(integer(attributes.str), 1, 30),
    dex: clamp(integer(attributes.dex), 1, 30),
    con: clamp(integer(attributes.con), 1, 30),
    int: clamp(integer(attributes.int), 1, 30),
    wis: clamp(integer(attributes.wis), 1, 30),
    cha: clamp(integer(attributes.cha), 1, 30),
  };
}

export function normalizeSavingThrowsSeed(
  savingThrows: Partial<SessionSavingThrowsState> | undefined,
): SessionSavingThrowsState {
  const defaults = defaultSavingThrows();
  if (!savingThrows) return defaults;
  return {
    str: Boolean(savingThrows.str),
    dex: Boolean(savingThrows.dex),
    con: Boolean(savingThrows.con),
    int: Boolean(savingThrows.int),
    wis: Boolean(savingThrows.wis),
    cha: Boolean(savingThrows.cha),
  };
}

export function normalizeSkillsSeed(
  skills: Partial<SessionSkillsState> | undefined,
): SessionSkillsState {
  const normalized = defaultSkills();
  if (!skills) return normalized;
  for (const skill of Object.keys(normalized) as Array<keyof SessionSkillsState>) {
    const proficiency = skills[skill];
    if (proficiency === "none" || proficiency === "proficient" || proficiency === "expertise") {
      normalized[skill] = proficiency;
    }
  }
  return normalized;
}

export function normalizeCharacterStateSeed(state: SessionHpSeed): SessionHpState {
  const max = Math.max(1, integer(state.max));
  const currentMax = clamp(integer(state.currentMax), 1, max);
  const maxHpBonus = integer(state.maxHpBonus);
  const effectiveMax = Math.max(1, currentMax + maxHpBonus);
  const hitDice = Object.fromEntries(
    Object.entries(state.hitDice ?? {}).flatMap(([side, pool]) => {
      if (!pool) return [];
      const normalizedMax = Math.max(0, integer(pool.max));
      return [[side, { current: clamp(integer(pool.current), 0, normalizedMax), max: normalizedMax }]];
    }),
  ) as SessionHpState["hitDice"];

  return {
    characterId: state.characterId,
    ownerUserId: state.ownerUserId?.trim() || undefined,
    current: clamp(integer(state.current), 0, effectiveMax),
    temporary: Math.max(0, integer(state.temporary)),
    max,
    currentMax,
    maxHpBonus,
    hitDice,
    stats: normalizeStatsSeed(state.stats),
    statsInitialized: state.stats !== undefined,
    attributes: normalizeAttributesSeed(state.attributes),
    attributesInitialized: state.attributes !== undefined,
    savingThrows: normalizeSavingThrowsSeed(state.savingThrows),
    savingThrowsInitialized: state.savingThrows !== undefined,
    skills: normalizeSkillsSeed(state.skills),
    skillsInitialized: state.skills !== undefined,
    revision: 0,
  };
}

export function applyCharacterStateOperation(
  previous: SessionHpState,
  operation: SessionAuthoritativeOperation,
  connection: SessionConnection,
): CharacterStateApplyResult {
  const permissionError = validatePermission(previous, connection);
  if (permissionError) return permissionError;

  const validationError = validateOperation(operation, previous);
  if (validationError) return validationError;

  const before = cloneState(previous);
  const next = mutateState(previous, operation);
  next.revision = previous.revision + 1;

  return {
    ok: true,
    next,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation,
      reverseOperation: createReverseOperation(operation, before),
    },
  };
}

export function applyCharacterStateUndo(
  current: SessionHpState,
  source: SessionHpLogRecord,
  connection: SessionConnection,
): CharacterStateApplyResult {
  if (connection.role !== "MASTER") {
    return { ok: false, code: "MASTER_REQUIRED", message: "Only the MASTER can undo session changes." };
  }
  if (source.undoneAt) {
    return { ok: false, code: "ALREADY_UNDONE", message: "This change has already been undone." };
  }
  if (source.reverseOperation.characterId !== current.characterId) {
    return { ok: false, code: "UNDO_TARGET_MISMATCH", message: "Undo target does not match the current character state." };
  }

  const beforeUndo = cloneState(current);
  let restored = cloneState(current);

  if (source.reverseOperation.type === "character.rest.restore") {
    const reverseState = source.reverseOperation.snapshot.hp as SessionHpState & {
      hitDice?: SessionHpState["hitDice"];
      stats?: SessionStatsState;
      statsInitialized?: boolean;
      attributes?: SessionAttributesState;
      attributesInitialized?: boolean;
      savingThrows?: SessionSavingThrowsState;
      savingThrowsInitialized?: boolean;
      skills?: SessionSkillsState;
      skillsInitialized?: boolean;
    };
    restored = cloneState({
      ...reverseState,
      hitDice: reverseState.hitDice ?? current.hitDice,
      stats: source.reverseOperation.snapshot.stats ?? reverseState.stats ?? current.stats,
      statsInitialized: true,
      attributes: reverseState.attributes ?? current.attributes,
      attributesInitialized: reverseState.attributesInitialized ?? current.attributesInitialized,
      savingThrows: reverseState.savingThrows ?? current.savingThrows,
      savingThrowsInitialized: reverseState.savingThrowsInitialized ?? current.savingThrowsInitialized,
      skills: reverseState.skills ?? current.skills,
      skillsInitialized: reverseState.skillsInitialized ?? current.skillsInitialized,
    });
  } else if (source.reverseOperation.type === "character.hp.restore") {
    const reverseState = source.reverseOperation.hp as SessionHpState & {
      hitDice?: SessionHpState["hitDice"];
      stats?: SessionStatsState;
      statsInitialized?: boolean;
      attributes?: SessionAttributesState;
      attributesInitialized?: boolean;
      savingThrows?: SessionSavingThrowsState;
      savingThrowsInitialized?: boolean;
      skills?: SessionSkillsState;
      skillsInitialized?: boolean;
    };
    restored = cloneState({
      ...reverseState,
      hitDice: reverseState.hitDice ?? current.hitDice,
      stats: reverseState.stats ?? current.stats,
      statsInitialized: reverseState.statsInitialized ?? current.statsInitialized,
      attributes: reverseState.attributes ?? current.attributes,
      attributesInitialized: reverseState.attributesInitialized ?? current.attributesInitialized,
      savingThrows: reverseState.savingThrows ?? current.savingThrows,
      savingThrowsInitialized: reverseState.savingThrowsInitialized ?? current.savingThrowsInitialized,
      skills: reverseState.skills ?? current.skills,
      skillsInitialized: reverseState.skillsInitialized ?? current.skillsInitialized,
    });
  } else if (source.reverseOperation.type === "character.attribute.restore") {
    restored.attributes[source.reverseOperation.attribute] = source.reverseOperation.value;
    restored.attributesInitialized = true;
  } else if (source.reverseOperation.type === "character.savingThrow.restore") {
    restored.savingThrows[source.reverseOperation.attribute] = source.reverseOperation.proficient;
    restored.savingThrowsInitialized = true;
  } else if (source.reverseOperation.type === "character.skill.restore") {
    restored.skills[source.reverseOperation.skill] = source.reverseOperation.proficiency;
    restored.skillsInitialized = true;
  } else if (isStatReverseOperation(source.reverseOperation)) {
    restoreSingleStat(restored, source.reverseOperation);
    restored.statsInitialized = true;
  } else {
    return {
      ok: false,
      code: "UNDO_TARGET_MISMATCH",
      message: "This undo operation belongs to a different authoritative domain.",
    };
  }

  restored.revision = current.revision + 1;

  return {
    ok: true,
    next: restored,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: { type: "character.hp.undo", characterId: current.characterId, sourceLogId: source.id },
      reverseOperation: { type: "character.hp.restore", characterId: current.characterId, hp: beforeUndo },
    },
  };
}

/** @deprecated Use normalizeCharacterStateSeed. */
export const normalizeHpSeed = normalizeCharacterStateSeed;
/** @deprecated Use applyCharacterStateOperation. */
export const applyHpOperation = applyCharacterStateOperation;
/** @deprecated Use applyCharacterStateUndo. */
export const applyHpUndo = applyCharacterStateUndo;

function createReverseOperation(
  operation: SessionAuthoritativeOperation,
  before: SessionHpState,
): SessionReverseOperation {
  if (isRestOperation(operation)) {
    return {
      type: "character.rest.restore",
      characterId: before.characterId,
      snapshot: { hp: before, stats: cloneStats(before.stats) },
    };
  }

  switch (operation.type) {
    case "character.attribute.set":
      return { type: "character.attribute.restore", characterId: before.characterId, attribute: operation.attribute, value: before.attributes[operation.attribute] };
    case "character.savingThrow.set":
      return { type: "character.savingThrow.restore", characterId: before.characterId, attribute: operation.attribute, proficient: before.savingThrows[operation.attribute] };
    case "character.skill.set":
      return { type: "character.skill.restore", characterId: before.characterId, skill: operation.skill, proficiency: before.skills[operation.skill] };
    case "character.stat.armorClass.set":
      return { type: "character.stat.armorClass.restore", characterId: before.characterId, adjustment: before.stats.armorClassAdjustment };
    case "character.stat.initiative.set":
      return { type: "character.stat.initiative.restore", characterId: before.characterId, adjustment: before.stats.initiativeAdjustment };
    case "character.stat.mobility.set":
      return { type: "character.stat.mobility.restore", characterId: before.characterId, adjustment: before.stats.mobilityAdjustment };
    case "character.stat.passivePerception.set":
      return { type: "character.stat.passivePerception.restore", characterId: before.characterId, adjustment: before.stats.passivePerceptionAdjustment };
    case "character.stat.exhaustion.set":
      return { type: "character.stat.exhaustion.restore", characterId: before.characterId, value: before.stats.exhaustion };
    case "character.stat.inspiration.set":
      return { type: "character.stat.inspiration.restore", characterId: before.characterId, value: before.stats.inspiration };
    case "character.stat.experience.set":
      return { type: "character.stat.experience.restore", characterId: before.characterId, value: before.stats.experience };
    default:
      return { type: "character.hp.restore", characterId: before.characterId, hp: before };
  }
}

function restoreSingleStat(
  state: SessionHpState,
  operation: Extract<SessionReverseOperation, { type: `character.stat.${string}` }>,
): void {
  switch (operation.type) {
    case "character.stat.armorClass.restore": state.stats.armorClassAdjustment = operation.adjustment; break;
    case "character.stat.initiative.restore": state.stats.initiativeAdjustment = operation.adjustment; break;
    case "character.stat.mobility.restore": state.stats.mobilityAdjustment = operation.adjustment; break;
    case "character.stat.passivePerception.restore": state.stats.passivePerceptionAdjustment = operation.adjustment; break;
    case "character.stat.exhaustion.restore": state.stats.exhaustion = operation.value; break;
    case "character.stat.inspiration.restore": state.stats.inspiration = operation.value; break;
    case "character.stat.experience.restore": state.stats.experience = operation.value; break;
  }
}

function isStatReverseOperation(
  operation: SessionReverseOperation,
): operation is Extract<SessionReverseOperation, { type: `character.stat.${string}` }> {
  return operation.type.startsWith("character.stat.");
}

function isRestOperation(operation: SessionAuthoritativeOperation): operation is SessionRestOperation {
  return operation.type === "character.rest.short" || operation.type === "character.rest.long";
}

function isStatOperation(operation: SessionAuthoritativeOperation): operation is SessionStatOperation {
  return operation.type.startsWith("character.stat.");
}

function validatePermission(
  state: SessionHpState,
  connection: SessionConnection,
): { ok: false; code: string; message: string } | null {
  if (connection.role === "MASTER") return null;
  if (state.ownerUserId && state.ownerUserId === connection.userId) return null;
  return { ok: false, code: "CHARACTER_FORBIDDEN", message: "Players may only change resources for characters they own." };
}

function validateOperation(
  operation: SessionAuthoritativeOperation,
  state: SessionHpState,
): { ok: false; code: string; message: string } | null {
  if (operation.characterId !== state.characterId) {
    return { ok: false, code: "CHARACTER_MISMATCH", message: "Operation target does not match the loaded character." };
  }

  if ((isStatOperation(operation) || operation.type === "character.rest.long") && !state.statsInitialized) {
    return invalid("STATS_NOT_INITIALIZED", "Stats for this character must be initialized by the MASTER first.");
  }
  if (operation.type === "character.attribute.set" && !state.attributesInitialized) {
    return invalid("ATTRIBUTES_NOT_INITIALIZED", "Attributes for this character must be initialized by the MASTER first.");
  }
  if (operation.type === "character.savingThrow.set" && !state.savingThrowsInitialized) {
    return invalid("SAVING_THROWS_NOT_INITIALIZED", "Saving throws for this character must be initialized by the MASTER first.");
  }
  if (operation.type === "character.skill.set" && !state.skillsInitialized) {
    return invalid("SKILLS_NOT_INITIALIZED", "Skills for this character must be initialized by the MASTER first.");
  }

  const validInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value);

  switch (operation.type) {
    case "character.attribute.set":
      if (!validInteger(operation.value) || operation.value < 1 || operation.value > 30) return invalid("INVALID_ATTRIBUTE", "Attribute scores must be integers from 1 to 30.");
      break;
    case "character.savingThrow.set":
      if (typeof operation.proficient !== "boolean") return invalid("INVALID_SAVING_THROW_PROFICIENCY", "Saving throw proficiency must be true or false.");
      break;
    case "character.skill.set":
      if (operation.proficiency !== "none" && operation.proficiency !== "proficient" && operation.proficiency !== "expertise") {
        return invalid("INVALID_SKILL_PROFICIENCY", "Skill proficiency must be none, proficient, or expertise.");
      }
      break;
    case "character.hp.damage":
    case "character.hp.heal":
    case "character.hp.temporary.add":
      if (!validInteger(operation.amount) || operation.amount <= 0) return invalid("INVALID_HP_AMOUNT", "HP change amount must be a positive integer.");
      break;
    case "character.hp.currentMax.adjust":
      if (!validInteger(operation.amount) || operation.amount === 0) return invalid("INVALID_HP_AMOUNT", "Maximum HP adjustment must be a non-zero integer.");
      break;
    case "character.hp.set":
    case "character.hp.temporary.set":
      if (!validInteger(operation.value) || operation.value < 0) return invalid("INVALID_HP_VALUE", "HP must be a non-negative integer.");
      break;
    case "character.hp.max.set":
      if (!validInteger(operation.value) || operation.value < 1) return invalid("INVALID_HP_MAX", "Maximum HP must be at least 1.");
      break;
    case "character.hitDice.use":
    case "character.hitDice.recover": {
      if (!validInteger(operation.amount) || operation.amount <= 0) return invalid("INVALID_HIT_DICE_AMOUNT", "Hit dice amount must be a positive integer.");
      const pool = state.hitDice[operation.side];
      if (!pool) return invalid("HIT_DICE_NOT_FOUND", `No ${operation.side} hit dice pool exists.`);
      if (operation.type === "character.hitDice.use" && operation.amount > pool.current) return invalid("INSUFFICIENT_HIT_DICE", `Not enough ${operation.side} hit dice are available.`);
      break;
    }
    case "character.hitDice.add":
      if (!validInteger(operation.amount) || operation.amount <= 0) return invalid("INVALID_HIT_DICE_AMOUNT", "Hit dice amount must be a positive integer.");
      break;
    case "character.hitDice.remove":
      if (!state.hitDice[operation.side]) return invalid("HIT_DICE_NOT_FOUND", `No ${operation.side} hit dice pool exists.`);
      break;
    case "character.stat.armorClass.set":
    case "character.stat.mobility.set":
    case "character.stat.passivePerception.set":
      if (!Number.isFinite(operation.value) || operation.value < 0 || !Number.isFinite(operation.calculatedValue)) return invalid("INVALID_STAT_VALUE", "Stat value and automatic value must be finite; this stat cannot be negative.");
      break;
    case "character.stat.initiative.set":
      if (!Number.isFinite(operation.value) || !Number.isFinite(operation.calculatedValue)) return invalid("INVALID_STAT_VALUE", "Initiative value and automatic value must be finite.");
      break;
    case "character.stat.exhaustion.set":
      if (!validInteger(operation.value) || operation.value < 0 || operation.value > 6) return invalid("INVALID_EXHAUSTION", "Exhaustion must be an integer from 0 to 6.");
      break;
    case "character.stat.experience.set":
      if (!validInteger(operation.value) || operation.value < 0) return invalid("INVALID_EXPERIENCE", "Experience must be a non-negative integer.");
      break;
    case "character.stat.inspiration.set":
      if (typeof operation.value !== "boolean") return invalid("INVALID_INSPIRATION", "Inspiration must be true or false.");
      break;
    case "character.rest.short":
      if (!validInteger(operation.healing) || operation.healing < 0) return invalid("INVALID_SHORT_REST_HEALING", "Short-rest healing must be a non-negative integer.");
      for (const [side, amount] of Object.entries(operation.hitDiceConsumption)) {
        if (!validInteger(amount) || amount < 0) return invalid("INVALID_HIT_DICE_AMOUNT", "Short-rest hit dice consumption must use non-negative integers.");
        const pool = state.hitDice[side as SessionDieSides];
        if ((amount ?? 0) > (pool?.current ?? 0)) return invalid("INSUFFICIENT_HIT_DICE", `Not enough ${side} hit dice are available.`);
      }
      break;
    case "character.rest.long":
      if (operation.recovery !== "partial" && operation.recovery !== "full") return invalid("INVALID_LONG_REST_RECOVERY", "Long-rest recovery must be partial or full.");
      break;
    case "character.hp.currentMax.restore":
      break;
  }
  return null;
}

function mutateState(previous: SessionHpState, operation: SessionAuthoritativeOperation): SessionHpState {
  const next = cloneState(previous);

  switch (operation.type) {
    case "character.attribute.set": next.attributes[operation.attribute] = operation.value; next.attributesInitialized = true; break;
    case "character.savingThrow.set": next.savingThrows[operation.attribute] = operation.proficient; next.savingThrowsInitialized = true; break;
    case "character.skill.set": next.skills[operation.skill] = operation.proficiency; next.skillsInitialized = true; break;
    case "character.hp.set": next.current = clamp(operation.value, 0, effectiveMax(next)); break;
    case "character.hp.temporary.set": next.temporary = Math.max(0, operation.value); break;
    case "character.hp.temporary.add": next.temporary = Math.max(0, next.temporary + operation.amount); break;
    case "character.hp.damage": {
      let remaining = operation.amount;
      const absorbed = Math.min(next.temporary, remaining);
      next.temporary -= absorbed;
      remaining -= absorbed;
      next.current = Math.max(0, next.current - remaining);
      break;
    }
    case "character.hp.heal": next.current = Math.min(effectiveMax(next), next.current + operation.amount); break;
    case "character.hp.max.set": {
      const previousRealMax = Math.max(1, next.max);
      const hadReduction = next.currentMax < previousRealMax;
      next.max = Math.max(1, operation.value);
      next.currentMax = hadReduction ? Math.min(next.max, next.currentMax) : next.max;
      next.current = Math.min(next.current, effectiveMax(next));
      break;
    }
    case "character.hp.currentMax.adjust": next.currentMax = clamp(next.currentMax + operation.amount, 1, next.max); next.current = Math.min(next.current, effectiveMax(next)); break;
    case "character.hp.currentMax.restore": next.currentMax = next.max; next.current = Math.min(next.current, effectiveMax(next)); break;
    case "character.hitDice.use": next.hitDice[operation.side]!.current -= operation.amount; break;
    case "character.hitDice.recover": { const pool = next.hitDice[operation.side]!; pool.current = Math.min(pool.max, pool.current + operation.amount); break; }
    case "character.hitDice.add": { const pool = next.hitDice[operation.side] ?? { current: 0, max: 0 }; next.hitDice[operation.side] = { current: pool.current + operation.amount, max: pool.max + operation.amount }; break; }
    case "character.hitDice.remove": delete next.hitDice[operation.side]; break;
    case "character.stat.armorClass.set": next.stats.armorClassAdjustment = cleanNumber(operation.value - operation.calculatedValue); next.statsInitialized = true; break;
    case "character.stat.initiative.set": next.stats.initiativeAdjustment = cleanNumber(operation.value - operation.calculatedValue); next.statsInitialized = true; break;
    case "character.stat.mobility.set": next.stats.mobilityAdjustment = cleanNumber(operation.value - operation.calculatedValue); next.statsInitialized = true; break;
    case "character.stat.passivePerception.set": next.stats.passivePerceptionAdjustment = cleanNumber(operation.value - operation.calculatedValue); next.statsInitialized = true; break;
    case "character.stat.exhaustion.set": next.stats.exhaustion = operation.value; next.statsInitialized = true; break;
    case "character.stat.inspiration.set": next.stats.inspiration = operation.value; next.statsInitialized = true; break;
    case "character.stat.experience.set": next.stats.experience = operation.value; next.statsInitialized = true; break;
    case "character.rest.short":
      next.current = Math.min(effectiveMax(next), next.current + operation.healing);
      for (const [side, amount] of Object.entries(operation.hitDiceConsumption)) {
        const pool = next.hitDice[side as SessionDieSides];
        if (pool && amount) pool.current -= amount;
      }
      break;
    case "character.rest.long": {
      const fraction = operation.recovery === "full" ? 1 : 0.5;
      const maximum = effectiveMax(next);
      next.current = Math.min(maximum, next.current + Math.ceil(Math.max(0, maximum - next.current) * fraction));
      next.temporary = 0;
      for (const pool of Object.values(next.hitDice)) {
        if (!pool) continue;
        pool.current = Math.min(pool.max, pool.current + Math.ceil(Math.max(0, pool.max - pool.current) * fraction));
      }
      if (operation.recovery === "partial") {
        next.stats.exhaustion = Math.min(6, next.stats.exhaustion + 1);
        next.statsInitialized = true;
      }
      break;
    }
  }
  return next;
}

function effectiveMax(state: SessionHpState): number { return Math.max(1, state.currentMax + state.maxHpBonus); }
function cloneStats(stats: SessionStatsState): SessionStatsState { return { ...stats }; }
function cloneAttributes(attributes: SessionAttributesState): SessionAttributesState { return { ...attributes }; }
function cloneSavingThrows(savingThrows: SessionSavingThrowsState): SessionSavingThrowsState { return { ...savingThrows }; }
function cloneSkills(skills: SessionSkillsState): SessionSkillsState { return { ...skills }; }
function cloneState(state: SessionHpState): SessionHpState {
  const hitDice = state.hitDice ?? {};
  return {
    ...state,
    hitDice: Object.fromEntries(Object.entries(hitDice).map(([side, pool]) => [side, pool ? { ...pool } : pool])) as SessionHpState["hitDice"],
    stats: cloneStats(state.stats ?? defaultStats()),
    statsInitialized: state.statsInitialized ?? false,
    attributes: cloneAttributes(state.attributes ?? defaultAttributes()),
    attributesInitialized: state.attributesInitialized ?? false,
    savingThrows: cloneSavingThrows(state.savingThrows ?? defaultSavingThrows()),
    savingThrowsInitialized: state.savingThrowsInitialized ?? false,
    skills: cloneSkills(state.skills ?? defaultSkills()),
    skillsInitialized: state.skillsInitialized ?? false,
  };
}
function integer(value: number): number { return Math.trunc(Number(value) || 0); }
function finite(value: number): number { return Number.isFinite(value) ? value : 0; }
function cleanNumber(value: number): number { return Math.abs(value) < 0.000001 ? 0 : Number(value.toFixed(4)); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function invalid(code: string, message: string): { ok: false; code: string; message: string } { return { ok: false, code, message }; }
