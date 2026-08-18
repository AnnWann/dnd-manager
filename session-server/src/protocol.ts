import { routeForSheetOperation, type CharacterSheetRoute } from "./routes/characters/sheet";

export type SessionRole = "MASTER" | "PLAYER";

export type SessionConnection = {
  sessionId: string;
  clientId: string;
  userId: string;
  role: SessionRole;
  connectedAt: number;
  lastHeartbeatAt: number;
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
  | { type: "character.hp.damage"; characterId: string; amount: number; requiresConcentrationCheck?: boolean; concentrationDc?: number; concentrationSource?: string }
  | { type: "character.hp.heal"; characterId: string; amount: number }
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
export type SessionConditionOperation =
  | { type: "character.condition.add"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.update"; characterId: string; condition: SessionCondition }
  | { type: "character.condition.remove"; characterId: string; conditionId: string };

export type SessionRestOperation =
  | { type: "character.rest.short"; characterId: string; healing: number; hitDiceConsumption: Partial<Record<SessionDieSides, number>> }
  | { type: "character.rest.long"; characterId: string; recovery: "partial" | "full" };

export type SessionAuthoritativeOperation = SessionHpOperation | SessionHitDiceOperation | SessionStatOperation | SessionAttributeOperation | SessionSavingThrowOperation | SessionSkillOperation | SessionRestOperation;
export type SessionLoggedOperation = SessionAuthoritativeOperation | SessionConditionOperation;

export type SessionHpReverseOperation = { type: "character.hp.restore"; characterId: string; hp: SessionHpState };
export type SessionStatReverseOperation =
  | { type: "character.stat.armorClass.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.initiative.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.mobility.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.passivePerception.restore"; characterId: string; adjustment: number }
  | { type: "character.stat.exhaustion.restore"; characterId: string; value: number }
  | { type: "character.stat.inspiration.restore"; characterId: string; value: boolean }
  | { type: "character.stat.experience.restore"; characterId: string; value: number };
export type SessionAttributeReverseOperation = { type: "character.attribute.restore"; characterId: string; attribute: SessionAttribute; value: number };
export type SessionSavingThrowReverseOperation = { type: "character.savingThrow.restore"; characterId: string; attribute: SessionAttribute; proficient: boolean };
export type SessionSkillReverseOperation = { type: "character.skill.restore"; characterId: string; skill: SessionSkill; proficiency: SessionSkillProficiency };
export type SessionConditionReverseOperation =
  | { type: "character.condition.delete"; characterId: string; conditionId: string }
  | { type: "character.condition.restore"; characterId: string; condition: SessionCondition };
export type SessionRestReverseOperation = {
  type: "character.rest.restore";
  characterId: string;
  snapshot: { hp: SessionHpState; stats: SessionStatsState };
};
export type SessionReverseOperation = SessionHpReverseOperation | SessionStatReverseOperation | SessionAttributeReverseOperation | SessionSavingThrowReverseOperation | SessionSkillReverseOperation | SessionConditionReverseOperation | SessionRestReverseOperation;

export type SessionHpLogRecord = {
  id: string;
  actorId: string;
  createdAt: string;
  operation: SessionLoggedOperation | { type: "character.hp.undo"; characterId: string; sourceLogId: string };
  reverseOperation: SessionReverseOperation;
  undoneAt?: string;
  undoneBy?: string;
};

export type SessionHeartbeatMessage = { type: "session.heartbeat"; clientId: string };
export type SessionPingMessage = { type: "session.ping" };
export type SessionHpInitializeMessage = { type: "session.hp.initialize"; characters: SessionHpSeed[] };
export type SessionHpOperationMessage = { type: "session.hp.operation"; operation: SessionAuthoritativeOperation };
export type SessionConditionsInitializeMessage = { type: "session.conditions.initialize"; characters: SessionConditionSeed[] };
export type SessionConditionOperationMessage = { type: "session.conditions.operation"; operation: SessionConditionOperation };
export type SessionSheetOperationWireMessage = { type: "session.sheet.operation"; route: CharacterSheetRoute; operation: SessionLoggedOperation };
export type SessionLogUndoMessage = { type: "session.log.undo"; logId: string };
export type ClientSessionMessage = SessionHeartbeatMessage | SessionPingMessage | SessionHpInitializeMessage | SessionHpOperationMessage | SessionConditionsInitializeMessage | SessionConditionOperationMessage | SessionLogUndoMessage;

export type SessionReadyMessage = { type: "session.ready"; sessionId: string; clientId: string; serverTime: number };
export type SessionHeartbeatAckMessage = { type: "session.heartbeat.ack"; serverTime: number };
export type SessionPongMessage = { type: "session.pong"; serverTime: number };
export type SessionPresenceUser = Pick<SessionConnection, "userId" | "clientId" | "role">;
export type SessionPresenceMessage = { type: "session.presence"; users: SessionPresenceUser[] };
export type SessionHpSnapshotMessage = { type: "session.hp.snapshot"; characters: SessionHpState[] };
export type SessionHpUpdatedMessage = { type: "session.hp.updated"; character: SessionHpState };
export type SessionConditionsSnapshotMessage = { type: "session.conditions.snapshot"; characters: SessionConditionsState[] };
export type SessionConditionsUpdatedMessage = { type: "session.conditions.updated"; character: SessionConditionsState };
export type SessionHpLogMessage = { type: "session.hp.log"; records: SessionHpLogRecord[] };
export type SessionErrorMessage = { type: "session.error"; code: string; message: string };
export type ServerSessionMessage = SessionReadyMessage | SessionHeartbeatAckMessage | SessionPongMessage | SessionPresenceMessage | SessionHpSnapshotMessage | SessionHpUpdatedMessage | SessionConditionsSnapshotMessage | SessionConditionsUpdatedMessage | SessionHpLogMessage | SessionErrorMessage;

const DIE_SIDES = new Set<SessionDieSides>(["d2", "d3", "d4", "d6", "d8", "d10", "d12", "d20", "d100"]);
const ATTRIBUTES = new Set<SessionAttribute>(["str", "dex", "con", "int", "wis", "cha"]);
const SKILLS = new Set<SessionSkill>([
  "acrobatics", "arcana", "athletics", "animalHandling", "performance", "deception",
  "stealth", "history", "intimidation", "insight", "investigation", "medicine",
  "nature", "perception", "persuasion", "sleightOfHand", "religion", "survival",
]);
const SKILL_PROFICIENCIES = new Set<SessionSkillProficiency>(["none", "proficient", "expertise"]);

export function parseClientSessionMessage(raw: string): ClientSessionMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "session.ping") return { type: "session.ping" };
  if (value.type === "session.heartbeat" && typeof value.clientId === "string" && value.clientId.length > 0) return { type: "session.heartbeat", clientId: value.clientId };
  if (value.type === "session.log.undo" && typeof value.logId === "string" && value.logId.length > 0) return { type: "session.log.undo", logId: value.logId };
  if (value.type === "session.hp.initialize" && Array.isArray(value.characters)) {
    const characters = value.characters.filter(isHpSeed);
    if (characters.length !== value.characters.length) return null;
    return { type: "session.hp.initialize", characters };
  }
  if (value.type === "session.conditions.initialize" && Array.isArray(value.characters)) {
    const characters = value.characters.filter(isConditionSeed);
    if (characters.length !== value.characters.length) return null;
    return { type: "session.conditions.initialize", characters };
  }
  if (value.type === "session.sheet.operation") return parseRoutedSheetOperation(value);
  if (value.type === "session.hp.operation" && isAuthoritativeOperation(value.operation)) return { type: "session.hp.operation", operation: value.operation };
  if (value.type === "session.conditions.operation" && isConditionOperation(value.operation)) return { type: "session.conditions.operation", operation: value.operation };
  return null;
}

function parseRoutedSheetOperation(value: Record<string, any>): SessionHpOperationMessage | SessionConditionOperationMessage | null {
  if (typeof value.route !== "string") return null;
  const operation = value.operation;
  const valid = isAuthoritativeOperation(operation) || isConditionOperation(operation);
  if (!valid) return null;

  let expectedRoute: CharacterSheetRoute;
  try { expectedRoute = routeForSheetOperation(operation); }
  catch { return null; }
  if (value.route !== expectedRoute) return null;

  if (isConditionOperation(operation)) return { type: "session.conditions.operation", operation };
  return { type: "session.hp.operation", operation };
}

function isHpSeed(value: unknown): value is SessionHpSeed {
  if (!isRecord(value)) return false;
  return typeof value.characterId === "string" && value.characterId.length > 0 &&
    (value.ownerUserId === undefined || typeof value.ownerUserId === "string") &&
    isFiniteNumber(value.current) && isFiniteNumber(value.temporary) && isFiniteNumber(value.max) &&
    isFiniteNumber(value.currentMax) && isFiniteNumber(value.maxHpBonus) &&
    (value.hitDice === undefined || isHitDiceState(value.hitDice)) &&
    (value.stats === undefined || isStatsState(value.stats)) &&
    (value.attributes === undefined || isAttributesState(value.attributes)) &&
    (value.savingThrows === undefined || isSavingThrowsSeed(value.savingThrows)) &&
    (value.skills === undefined || isSkillsSeed(value.skills));
}

function isConditionSeed(value: unknown): value is SessionConditionSeed {
  return isRecord(value) && typeof value.characterId === "string" && value.characterId.length > 0 &&
    Array.isArray(value.conditions) && value.conditions.every(isCondition);
}

function isAuthoritativeOperation(value: unknown): value is SessionAuthoritativeOperation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.characterId !== "string" || !value.characterId) return false;
  switch (value.type) {
    case "character.hp.set":
    case "character.hp.temporary.set":
    case "character.hp.max.set": return isFiniteNumber(value.value);
    case "character.hp.temporary.add":
    case "character.hp.damage":
    case "character.hp.heal":
    case "character.hp.currentMax.adjust": return isFiniteNumber(value.amount);
    case "character.hp.currentMax.restore": return true;
    case "character.hitDice.use":
    case "character.hitDice.recover":
    case "character.hitDice.add": return isDieSide(value.side) && isFiniteNumber(value.amount);
    case "character.hitDice.remove": return isDieSide(value.side);
    case "character.stat.armorClass.set":
    case "character.stat.initiative.set":
    case "character.stat.mobility.set":
    case "character.stat.passivePerception.set": return isFiniteNumber(value.value) && isFiniteNumber(value.calculatedValue);
    case "character.stat.exhaustion.set":
    case "character.stat.experience.set": return isFiniteNumber(value.value);
    case "character.stat.inspiration.set": return typeof value.value === "boolean";
    case "character.attribute.set": return isAttribute(value.attribute) && isFiniteNumber(value.value);
    case "character.savingThrow.set": return isAttribute(value.attribute) && typeof value.proficient === "boolean";
    case "character.skill.set": return isSkill(value.skill) && isSkillProficiency(value.proficiency);
    case "character.rest.short": return isFiniteNumber(value.healing) && isHitDiceConsumption(value.hitDiceConsumption);
    case "character.rest.long": return value.recovery === "partial" || value.recovery === "full";
    default: return false;
  }
}

function isConditionOperation(value: unknown): value is SessionConditionOperation {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.characterId !== "string" || !value.characterId) return false;
  switch (value.type) {
    case "character.condition.add":
    case "character.condition.update": return isCondition(value.condition);
    case "character.condition.remove": return typeof value.conditionId === "string" && value.conditionId.length > 0;
    default: return false;
  }
}

function isCondition(value: unknown): value is SessionCondition {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.description === "string" &&
    typeof value.behavior === "string" && typeof value.source === "string" && typeof value.notes === "string" &&
    Array.isArray(value.tags) && typeof value.createdAt === "string" && isRecord(value.duration) && typeof value.duration.type === "string";
}

function isStatsState(value: unknown): value is SessionStatsState {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.armorClassAdjustment) && isFiniteNumber(value.initiativeAdjustment) &&
    isFiniteNumber(value.mobilityAdjustment) && isFiniteNumber(value.passivePerceptionAdjustment) &&
    isFiniteNumber(value.exhaustion) && typeof value.inspiration === "boolean" && isFiniteNumber(value.experience);
}
function isAttributesState(value: unknown): value is SessionAttributesState {
  if (!isRecord(value)) return false;
  return [...ATTRIBUTES].every((attribute) => isFiniteNumber(value[attribute]));
}
function isSavingThrowsSeed(value: unknown): value is Partial<SessionSavingThrowsState> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([attribute, proficient]) => isAttribute(attribute) && typeof proficient === "boolean");
}
function isSkillsSeed(value: unknown): value is Partial<SessionSkillsState> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([skill, proficiency]) => isSkill(skill) && isSkillProficiency(proficiency));
}
function isHitDiceState(value: unknown): value is SessionHitDiceState {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([side, pool]) => isDieSide(side) && isRecord(pool) && isFiniteNumber(pool.current) && isFiniteNumber(pool.max));
}
function isHitDiceConsumption(value: unknown): value is Partial<Record<SessionDieSides, number>> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([side, amount]) => isDieSide(side) && isFiniteNumber(amount));
}
function isAttribute(value: unknown): value is SessionAttribute { return typeof value === "string" && ATTRIBUTES.has(value as SessionAttribute); }
function isSkill(value: unknown): value is SessionSkill { return typeof value === "string" && SKILLS.has(value as SessionSkill); }
function isSkillProficiency(value: unknown): value is SessionSkillProficiency { return typeof value === "string" && SKILL_PROFICIENCIES.has(value as SessionSkillProficiency); }
function isDieSide(value: unknown): value is SessionDieSides { return typeof value === "string" && DIE_SIDES.has(value as SessionDieSides); }
function isFiniteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
export function encodeServerSessionMessage(message: ServerSessionMessage): string { return JSON.stringify(message); }
