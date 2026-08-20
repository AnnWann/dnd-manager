import { routeForSheetOperation, type CharacterSheetRoute } from "../characters/sheet";

export type SessionRole = "MASTER" | "PLAYER";

export type SessionConnection = {
  sessionId: string;
  clientId: string;
  userId: string;
  role: SessionRole;
  connectedAt: number;
  lastHeartbeatAt: number;
  /** Saved Creation revision used to calculate this connection's visible character set. */
  runtimeConfigRevision?: number;
  /** Character ids this connection may receive. MASTER connections do not require this list. */
  visibleCharacterIds?: string[];
};

export type SessionDieSides =
  | "d2" | "d3" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export type SessionHitDicePool = { current: number; max: number };
export type SessionHitDiceState = Partial<Record<SessionDieSides, SessionHitDicePool>>;

export type SessionAttribute = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type SessionAttributesState = Record<SessionAttribute, number>;
export type SessionSavingThrowsState = Record<SessionAttribute, boolean>;
export type SessionSkill =
  | "acrobatics" | "arcana" | "athletics" | "animalHandling" | "performance"
  | "deception" | "stealth" | "history" | "intimidation" | "insight"
  | "investigation" | "medicine" | "nature" | "perception" | "persuasion"
  | "sleightOfHand" | "religion" | "survival";
export type SessionSkillProficiency = "none" | "proficient" | "expertise";
export type SessionSkillsState = Record<SessionSkill, SessionSkillProficiency>;

export type SessionStatsState = {
  armorClassAdjustment: number;
  initiativeAdjustment: number;
  mobilityAdjustment: number;
  passivePerceptionAdjustment: number;
  exhaustion: number;
  inspiration: boolean;
  experience: number;
};

export type SessionConditionDuration = {
  type:
    | "rounds" | "turns" | "minutes" | "hours" | "days"
    | "until-start-of-turn" | "until-end-of-turn" | "until-save"
    | "concentration" | "permanent" | "custom";
  total?: number;
  remaining?: number;
  tickOn?: "start-of-turn" | "end-of-turn" | "manual";
  tickOwner?: "affected" | "source";
  autoRemoveAtZero?: boolean;
  customLabel?: string;
  expiresAt?: string;
};

export type SessionCondition = {
  id: string;
  name: string;
  description: string;
  behavior: string;
  source: string;
  notes: string;
  tags: string[];
  bonuses?: unknown;
  grantedSpells?: unknown[];
  grantedProficiencies?: unknown[];
  grantedAbilities?: unknown[];
  duration: SessionConditionDuration;
  createdAt: string;
  sourceAbilityId?: string;
  sourceAbilityLocation?: "character" | "race" | "equipment" | "condition";
  sourceItemId?: string;
  sourceAbilityOptionId?: string;
  sourceCharacterId?: string;
  linkedCombatantId?: string;
  initiativeEffectId?: string;
};

export type SessionConditionsState = {
  characterId: string;
  conditions: SessionCondition[];
  initialized: boolean;
  revision: number;
};

export type SessionConditionSeed = {
  characterId: string;
  conditions: SessionCondition[];
};

export type SessionHpState = {
  characterId: string;
  ownerUserId?: string;
  current: number;
  temporary: number;
  max: number;
  currentMax: number;
  maxHpBonus: number;
  hitDice: SessionHitDiceState;
  stats: SessionStatsState;
  statsInitialized: boolean;
  attributes: SessionAttributesState;
  attributesInitialized: boolean;
  savingThrows: SessionSavingThrowsState;
  savingThrowsInitialized: boolean;
  skills: SessionSkillsState;
  skillsInitialized: boolean;
  revision: number;
};

export type SessionHpSeed = Omit<SessionHpState, "revision" | "hitDice" | "stats" | "statsInitialized" | "attributes" | "attributesInitialized" | "savingThrows" | "savingThrowsInitialized" | "skills" | "skillsInitialized"> & {
  hitDice?: SessionHitDiceState;
  stats?: SessionStatsState;
  attributes?: SessionAttributesState;
  savingThrows?: Partial<SessionSavingThrowsState>;
  skills?: Partial<SessionSkillsState>;
};

export type SessionHpOperation =
  | { type: "character.hp.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.set"; characterId: string; value: number }
  | { type: "character.hp.temporary.add"; characterId: string; amount: number }
  | { type: "character.hp.damage"; characterId: string; amount: number; damageType?: string; source?: string; requiresConcentrationCheck?: boolean; concentrationDc?: number; concentrationSource?: string }
  | { type: "character.hp.heal"; characterId: string; amount: number; source?: string }
  | { type: "character.hp.max.set"; characterId: string; value: number }
  | { type: "character.hp.currentMax.adjust"; characterId: string; amount: number }
  | { type: "character.hp.currentMax.restore"; characterId: string };

export type SessionHitDiceOperation =
  | { type: "character.hitDice.use"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.recover"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.add"; characterId: string; side: SessionDieSides; amount: number }
  | { type: "character.hitDice.remove"; characterId: string; side: SessionDieSides };

export type SessionCalculatedStatOperation =
  | { type: "character.stat.armorClass.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.initiative.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.mobility.set"; characterId: string; value: number; calculatedValue: number }
  | { type: "character.stat.passivePerception.set"; characterId: string; value: number; calculatedValue: number };

export type SessionSimpleStatOperation =
  | { type: "character.stat.exhaustion.set"; characterId: string; value: number }
  | { type: "character.stat.inspiration.set"; characterId: string; value: boolean }
  | { type: "character.stat.experience.set"; characterId: string; value: number };

export type SessionStatOperation = SessionCalculatedStatOperation | SessionSimpleStatOperation;
export type SessionAttributeOperation = { type: "character.attribute.set"; characterId: string; attribute: SessionAttribute; value: number };
export type SessionSavingThrowOperation = { type: "character.savingThrow.set"; characterId: string; attribute: SessionAttribute; proficient: boolean };
export type SessionSkillOperation = { type: "character.skill.set"; characterId: string; skill: SessionSkill; proficiency: SessionSkillProficiency };

export type SessionRestOperation =
  | {
      type: "character.rest.short";
      characterId: string;
      healing: number;
      hitDiceConsumption: Partial<Record<SessionDieSides, number>>;
    }
  | {
      type: "character.rest.long";
      characterId: string;
      selection: Array<{ itemId: string; portions: number }>;
      recovery: "full" | "partial";
    };

export type SessionConditionOperation =
  | { type: "character.condition.add"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.update"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.remove"; characterId: string; conditionId: string };

export type SessionConcentrationOperation =
  | { type: "character.concentration.start"; characterId: string; spellIndex: string; spellName: string }
  | { type: "character.concentration.end"; characterId: string; reason?: "manual" | "failed-save" };

export type SessionConditionReverseOperation =
  | { type: "character.condition.delete"; characterId: string; conditionId: string }
  | { type: "character.condition.restore"; characterId: string; condition: SessionCondition };

export type SessionConcentrationReverseOperation = {
  type: "character.concentration.restore";
  characterId: string;
  conditions: SessionCondition[];
};

export type SessionReverseOperation =
  | { type: "character.hp.restore"; characterId: string; hp: SessionHpState }
  | { type: "character.stat.armorClass.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.initiative.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.mobility.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.passivePerception.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.exhaustion.restore"; characterId: string; value: number }
  | { type: "character.stat.inspiration.restore"; characterId: string; value: boolean }
  | { type: "character.stat.experience.restore"; characterId: string; value: number }
  | { type: "character.attribute.restore"; characterId: string; attribute: SessionAttribute; value: number }
  | { type: "character.savingThrow.restore"; characterId: string; attribute: SessionAttribute; proficient: boolean }
  | { type: "character.skill.restore"; characterId: string; skill: SessionSkill; proficiency: SessionSkillProficiency }
  | SessionConditionReverseOperation
  | SessionConcentrationReverseOperation
  | { type: "character.rest.restore"; characterId: string; snapshot: { hp: SessionHpState; stats: SessionStatsState } };

export type SessionAuthoritativeOperation =
  | SessionHpOperation
  | SessionHitDiceOperation
  | SessionStatOperation
  | SessionAttributeOperation
  | SessionSavingThrowOperation
  | SessionSkillOperation
  | SessionRestOperation;

export type SessionLoggedOperation = SessionAuthoritativeOperation | SessionConditionOperation | SessionConcentrationOperation;

export type SessionHpLogRecord = {
  id: string;
  createdAt: string;
  actorId: string;
  operation: SessionLoggedOperation | { type: "character.hp.undo"; characterId: string; sourceLogId: string };
  reverseOperation: SessionReverseOperation;
  affectedScopes?: string[];
  undoneAt?: string;
  undoneBy?: string;
  undoLogId?: string;
};

export type SessionPresenceUser = {
  userId: string;
  clientId: string;
  role: SessionRole;
};

export type SessionRuntimePresenceUser = SessionPresenceUser;
export type SessionRuntimeRole = SessionRole;

export type ClientSessionMessage =
  | { type: "session.heartbeat"; clientId: string }
  | { type: "session.ping" }
  | { type: "session.hp.initialize"; characters: SessionHpSeed[] }
  | { type: "session.hp.operation"; operation: SessionAuthoritativeOperation }
  | { type: "session.conditions.initialize"; characters: SessionConditionSeed[] }
  | { type: "session.conditions.operation"; operation: SessionConditionOperation | SessionConcentrationOperation }
  | { type: "session.sheet.operation"; route: CharacterSheetRoute; operation: SessionLoggedOperation }
  | { type: "session.log.undo"; logId: string };

export type ServerSessionMessage =
  | { type: "session.ready"; sessionId: string; clientId: string; serverTime: number }
  | { type: "session.heartbeat.ack"; serverTime: number }
  | { type: "session.pong"; serverTime: number }
  | { type: "session.presence"; users: SessionPresenceUser[] }
  | { type: "session.hp.snapshot"; characters: SessionHpState[] }
  | { type: "session.hp.updated"; character: SessionHpState }
  | { type: "session.conditions.snapshot"; characters: SessionConditionsState[] }
  | { type: "session.conditions.updated"; character: SessionConditionsState }
  | { type: "session.hp.log"; records: SessionHpLogRecord[] }
  | { type: "session.error"; code: string; message: string };

export function parseClientSessionMessage(raw: string): ClientSessionMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "session.heartbeat":
      return nonEmpty(value.clientId) ? { type: value.type, clientId: value.clientId } : null;
    case "session.ping":
      return { type: value.type };
    case "session.hp.initialize":
      return Array.isArray(value.characters) && value.characters.every(isHpSeed)
        ? { type: value.type, characters: value.characters }
        : null;
    case "session.hp.operation":
      return isAuthoritativeOperation(value.operation)
        ? { type: value.type, operation: value.operation }
        : null;
    case "session.conditions.initialize":
      return Array.isArray(value.characters) && value.characters.every(isConditionSeed)
        ? { type: value.type, characters: value.characters }
        : null;
    case "session.conditions.operation":
      return isConditionOperation(value.operation) || isConcentrationOperation(value.operation)
        ? { type: value.type, operation: value.operation }
        : null;
    case "session.sheet.operation": {
      if (!isRecord(value.operation)) return null;
      const route = routeForSheetOperation(value.operation as SessionLoggedOperation);
      return route
        ? { type: value.type, route, operation: value.operation as SessionLoggedOperation }
        : null;
    }
    case "session.log.undo":
      return nonEmpty(value.logId) ? { type: value.type, logId: value.logId } : null;
    default:
      return null;
  }
}

export function encodeServerSessionMessage(message: ServerSessionMessage): string {
  return JSON.stringify(message);
}

function isHpSeed(value: unknown): value is SessionHpSeed {
  return isRecord(value)
    && nonEmpty(value.characterId)
    && integer(value.current)
    && integer(value.temporary)
    && integer(value.max)
    && integer(value.currentMax)
    && integer(value.maxHpBonus)
    && (value.ownerUserId === undefined || typeof value.ownerUserId === "string")
    && (value.hitDice === undefined || isRecord(value.hitDice))
    && (value.stats === undefined || isStatsState(value.stats))
    && (value.attributes === undefined || isAttributesState(value.attributes))
    && (value.savingThrows === undefined || isRecord(value.savingThrows))
    && (value.skills === undefined || isRecord(value.skills));
}

function isAuthoritativeOperation(value: unknown): value is SessionAuthoritativeOperation {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.characterId)) return false;
  switch (value.type) {
    case "character.hp.set":
    case "character.hp.temporary.set":
    case "character.hp.max.set":
      return nonNegativeInteger(value.value);
    case "character.hp.temporary.add":
    case "character.hp.damage":
    case "character.hp.heal":
      return positiveInteger(value.amount);
    case "character.hp.currentMax.adjust":
      return typeof value.amount === "number" && Number.isInteger(value.amount) && value.amount !== 0;
    case "character.hp.currentMax.restore":
      return true;
    case "character.hitDice.use":
    case "character.hitDice.recover":
    case "character.hitDice.add":
      return dieSides(value.side) && positiveInteger(value.amount);
    case "character.hitDice.remove":
      return dieSides(value.side);
    case "character.stat.armorClass.set":
    case "character.stat.initiative.set":
    case "character.stat.mobility.set":
    case "character.stat.passivePerception.set":
      return typeof value.value === "number"
        && Number.isFinite(value.value)
        && typeof value.calculatedValue === "number"
        && Number.isFinite(value.calculatedValue);
    case "character.stat.exhaustion.set":
    case "character.stat.experience.set":
      return nonNegativeInteger(value.value);
    case "character.stat.inspiration.set":
      return typeof value.value === "boolean";
    case "character.attribute.set":
      return attribute(value.attribute) && typeof value.value === "number" && Number.isInteger(value.value);
    case "character.savingThrow.set":
      return attribute(value.attribute) && typeof value.proficient === "boolean";
    case "character.skill.set":
      return skill(value.skill) && skillProficiency(value.proficiency);
    case "character.rest.short":
      return nonNegativeInteger(value.healing) && isRecord(value.hitDiceConsumption);
    case "character.rest.long":
      return (value.recovery === "full" || value.recovery === "partial")
        && Array.isArray(value.selection)
        && value.selection.every(isLongRestSelection);
    default:
      return false;
  }
}

function isConditionOperation(value: unknown): value is SessionConditionOperation {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.characterId)) return false;
  if (value.type === "character.condition.add" || value.type === "character.condition.update") {
    return isCondition(value.condition);
  }
  return value.type === "character.condition.remove" && nonEmpty(value.conditionId);
}

function isConcentrationOperation(value: unknown): value is SessionConcentrationOperation {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.characterId)) return false;
  if (value.type === "character.concentration.start") return nonEmpty(value.spellIndex) && nonEmpty(value.spellName);
  return value.type === "character.concentration.end"
    && (value.reason === undefined || value.reason === "manual" || value.reason === "failed-save");
}

function isConditionSeed(value: unknown): value is SessionConditionSeed {
  return isRecord(value) && nonEmpty(value.characterId) && Array.isArray(value.conditions) && value.conditions.every(isCondition);
}

function isCondition(value: unknown): value is SessionCondition {
  return isRecord(value)
    && nonEmpty(value.id)
    && typeof value.name === "string"
    && typeof value.description === "string"
    && typeof value.behavior === "string"
    && typeof value.source === "string"
    && typeof value.notes === "string"
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === "string")
    && isRecord(value.duration)
    && nonEmpty(value.duration.type)
    && typeof value.createdAt === "string";
}

function isStatsState(value: unknown): value is SessionStatsState {
  return isRecord(value)
    && Number.isFinite(Number(value.armorClassAdjustment))
    && Number.isFinite(Number(value.initiativeAdjustment))
    && Number.isFinite(Number(value.mobilityAdjustment))
    && Number.isFinite(Number(value.passivePerceptionAdjustment))
    && nonNegativeInteger(value.exhaustion)
    && typeof value.inspiration === "boolean"
    && nonNegativeInteger(value.experience);
}

function isAttributesState(value: unknown): value is SessionAttributesState {
  return isRecord(value) && (["str", "dex", "con", "int", "wis", "cha"] as const).every((key) => Number.isFinite(Number(value[key])));
}

function isLongRestSelection(value: unknown): boolean {
  return isRecord(value)
    && nonEmpty(value.itemId)
    && typeof value.portions === "number"
    && Number.isFinite(value.portions)
    && value.portions > 0;
}

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value); }
function nonNegativeInteger(value: unknown): value is number { return integer(value) && value >= 0; }
function positiveInteger(value: unknown): value is number { return nonNegativeInteger(value) && value > 0; }
function attribute(value: unknown): value is SessionAttribute { return value === "str" || value === "dex" || value === "con" || value === "int" || value === "wis" || value === "cha"; }
function dieSides(value: unknown): value is SessionDieSides { return typeof value === "string" && /^d(2|3|4|6|8|10|12|20|100)$/.test(value); }
function skill(value: unknown): value is SessionSkill {
  return typeof value === "string" && new Set<SessionSkill>([
    "acrobatics", "arcana", "athletics", "animalHandling", "performance",
    "deception", "stealth", "history", "intimidation", "insight",
    "investigation", "medicine", "nature", "perception", "persuasion",
    "sleightOfHand", "religion", "survival",
  ]).has(value as SessionSkill);
}
function skillProficiency(value: unknown): value is SessionSkillProficiency { return value === "none" || value === "proficient" || value === "expertise"; }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
