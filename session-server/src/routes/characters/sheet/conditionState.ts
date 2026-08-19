import type {
  SessionCondition,
  SessionConditionOperation,
  SessionConditionReverseOperation,
  SessionConditionsState,
  SessionConnection,
  SessionHpLogRecord,
} from "./protocol";

const CONCENTRATION_TAG = "dnd-manager:concentrating";

export type ConditionApplyResult =
  | { ok: true; next: SessionConditionsState; record: SessionHpLogRecord }
  | { ok: false; code: string; message: string };

export function normalizeConditionsSeed(
  characterId: string,
  conditions: SessionCondition[],
): SessionConditionsState {
  return {
    characterId,
    conditions: conditions.map(normalizeCondition),
    initialized: true,
    revision: 0,
  };
}

export function applyConditionOperation(
  previous: SessionConditionsState,
  operation: SessionConditionOperation,
  connection: SessionConnection,
  ownerUserId?: string,
): ConditionApplyResult {
  const permissionError = validatePermission(connection, ownerUserId);
  if (permissionError) return permissionError;

  if (!previous.initialized) {
    return invalid("CONDITIONS_NOT_INITIALIZED", "Conditions for this character must be initialized by the MASTER first.");
  }
  if (operation.characterId !== previous.characterId) {
    return invalid("CHARACTER_MISMATCH", "Operation target does not match the loaded character.");
  }

  const next = cloneState(previous);
  let reverseOperation: SessionConditionReverseOperation;

  switch (operation.type) {
    case "character.condition.add": {
      if (isConcentrationCondition(operation.condition)) return concentrationDomainRequired();
      const conditionError = validateCondition(operation.condition);
      if (conditionError) return conditionError;
      if (next.conditions.some((condition) => condition.id === operation.condition.id)) {
        return invalid("CONDITION_ALREADY_EXISTS", "A condition with this id already exists on the character.");
      }
      const condition = normalizeCondition(operation.condition);
      next.conditions.push(condition);
      reverseOperation = {
        type: "character.condition.delete",
        characterId: previous.characterId,
        conditionId: condition.id,
      };
      break;
    }

    case "character.condition.update": {
      const index = next.conditions.findIndex((condition) => condition.id === operation.condition.id);
      if (index < 0) return invalid("CONDITION_NOT_FOUND", "The condition to update does not exist.");
      if (isConcentrationCondition(next.conditions[index]) || isConcentrationCondition(operation.condition)) return concentrationDomainRequired();
      const conditionError = validateCondition(operation.condition);
      if (conditionError) return conditionError;
      const previousCondition = cloneCondition(next.conditions[index]);
      next.conditions[index] = normalizeCondition(operation.condition);
      reverseOperation = {
        type: "character.condition.restore",
        characterId: previous.characterId,
        condition: previousCondition,
      };
      break;
    }

    case "character.condition.remove": {
      const index = next.conditions.findIndex((condition) => condition.id === operation.conditionId);
      if (index < 0) return invalid("CONDITION_NOT_FOUND", "The condition to remove does not exist.");
      if (isConcentrationCondition(next.conditions[index])) return concentrationDomainRequired();
      const [removed] = next.conditions.splice(index, 1);
      reverseOperation = {
        type: "character.condition.restore",
        characterId: previous.characterId,
        condition: cloneCondition(removed),
      };
      break;
    }
  }

  next.revision = previous.revision + 1;
  return {
    ok: true,
    next,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation,
      reverseOperation,
    },
  };
}

export function applyConditionUndo(
  current: SessionConditionsState,
  source: SessionHpLogRecord,
  connection: SessionConnection,
): ConditionApplyResult {
  if (connection.role !== "MASTER") {
    return invalid("MASTER_REQUIRED", "Only the MASTER can undo session changes.");
  }
  if (source.undoneAt) {
    return invalid("ALREADY_UNDONE", "This change has already been undone.");
  }

  const reverse = source.reverseOperation;
  if (reverse.type !== "character.condition.delete" && reverse.type !== "character.condition.restore") {
    return invalid("UNDO_TARGET_MISMATCH", "This log entry is not a condition operation.");
  }
  if (reverse.characterId !== current.characterId) {
    return invalid("UNDO_TARGET_MISMATCH", "Undo target does not match the current character state.");
  }

  const next = cloneState(current);
  let undoReverse: SessionConditionReverseOperation;

  if (reverse.type === "character.condition.delete") {
    const index = next.conditions.findIndex((condition) => condition.id === reverse.conditionId);
    if (index < 0) return invalid("CONDITION_NOT_FOUND", "The condition created by this operation is no longer present.");
    const [removed] = next.conditions.splice(index, 1);
    undoReverse = {
      type: "character.condition.restore",
      characterId: current.characterId,
      condition: cloneCondition(removed),
    };
  } else {
    const restoredCondition = normalizeCondition(reverse.condition);
    const index = next.conditions.findIndex((condition) => condition.id === restoredCondition.id);
    if (index >= 0) {
      const replaced = cloneCondition(next.conditions[index]);
      next.conditions[index] = restoredCondition;
      undoReverse = {
        type: "character.condition.restore",
        characterId: current.characterId,
        condition: replaced,
      };
    } else {
      next.conditions.push(restoredCondition);
      undoReverse = {
        type: "character.condition.delete",
        characterId: current.characterId,
        conditionId: restoredCondition.id,
      };
    }
  }

  next.revision = current.revision + 1;
  return {
    ok: true,
    next,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: {
        type: "character.hp.undo",
        characterId: current.characterId,
        sourceLogId: source.id,
      },
      reverseOperation: undoReverse,
    },
  };
}

function validatePermission(
  connection: SessionConnection,
  ownerUserId?: string,
): { ok: false; code: string; message: string } | null {
  if (connection.role === "MASTER") return null;
  if (ownerUserId && ownerUserId === connection.userId) return null;
  return invalid("CHARACTER_FORBIDDEN", "Players may only change conditions for characters they own.");
}

function validateCondition(
  condition: SessionCondition,
): { ok: false; code: string; message: string } | null {
  if (!condition || typeof condition !== "object") return invalid("INVALID_CONDITION", "Condition must be an object.");
  if (!validString(condition.id, 1, 200)) return invalid("INVALID_CONDITION_ID", "Condition id is required and must be at most 200 characters.");
  if (!validString(condition.name, 1, 200)) return invalid("INVALID_CONDITION_NAME", "Condition name is required and must be at most 200 characters.");
  for (const [field, value, max] of [
    ["description", condition.description, 20_000],
    ["behavior", condition.behavior, 20_000],
    ["source", condition.source, 1_000],
    ["notes", condition.notes, 20_000],
    ["createdAt", condition.createdAt, 200],
  ] as const) {
    if (typeof value !== "string" || value.length > max) return invalid("INVALID_CONDITION", `Condition ${field} is invalid.`);
  }
  if (!Array.isArray(condition.tags) || condition.tags.length > 50 || condition.tags.some((tag) => !validString(tag, 0, 200))) {
    return invalid("INVALID_CONDITION_TAGS", "Condition tags are invalid.");
  }

  const duration = condition.duration;
  if (!duration || typeof duration !== "object") return invalid("INVALID_CONDITION_DURATION", "Condition duration is required.");
  const allowedTypes = new Set([
    "rounds", "turns", "minutes", "hours", "days", "until-start-of-turn", "until-end-of-turn",
    "until-save", "concentration", "permanent", "custom",
  ]);
  if (!allowedTypes.has(duration.type)) return invalid("INVALID_CONDITION_DURATION", "Condition duration type is invalid.");
  for (const value of [duration.total, duration.remaining]) {
    if (value !== undefined && (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
      return invalid("INVALID_CONDITION_DURATION", "Numeric condition durations must be non-negative integers.");
    }
  }
  if (duration.tickOn !== undefined && duration.tickOn !== "start-of-turn" && duration.tickOn !== "end-of-turn" && duration.tickOn !== "manual") {
    return invalid("INVALID_CONDITION_DURATION", "Condition tick timing is invalid.");
  }
  if (duration.tickOwner !== undefined && duration.tickOwner !== "affected" && duration.tickOwner !== "source") {
    return invalid("INVALID_CONDITION_DURATION", "Condition tick owner is invalid.");
  }
  if (duration.autoRemoveAtZero !== undefined && typeof duration.autoRemoveAtZero !== "boolean") {
    return invalid("INVALID_CONDITION_DURATION", "autoRemoveAtZero must be boolean.");
  }
  if (duration.customLabel !== undefined && !validString(duration.customLabel, 0, 1_000)) return invalid("INVALID_CONDITION_DURATION", "Custom duration label is invalid.");
  if (duration.expiresAt !== undefined && !validString(duration.expiresAt, 0, 200)) return invalid("INVALID_CONDITION_DURATION", "Condition expiration is invalid.");

  try {
    if (JSON.stringify(condition).length > 100_000) return invalid("CONDITION_TOO_LARGE", "Condition payload is too large.");
  } catch {
    return invalid("INVALID_CONDITION", "Condition payload is not serializable.");
  }
  return null;
}

function normalizeCondition(condition: SessionCondition): SessionCondition {
  return cloneCondition({
    ...condition,
    id: condition.id.trim(),
    name: condition.name.trim(),
    description: condition.description ?? "",
    behavior: condition.behavior ?? "",
    source: condition.source ?? "",
    notes: condition.notes ?? "",
    tags: [...(condition.tags ?? [])],
    duration: { ...condition.duration },
  });
}

function isConcentrationCondition(condition: SessionCondition): boolean {
  return condition.tags.includes(CONCENTRATION_TAG) || normalize(condition.name) === "concentrando";
}
function concentrationDomainRequired() {
  return invalid("CONCENTRATION_DOMAIN_REQUIRED", "Concentration conditions must be changed through characters/sheet/concentration.");
}
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}
function cloneCondition(condition: SessionCondition): SessionCondition { return structuredClone(condition); }
function cloneState(state: SessionConditionsState): SessionConditionsState { return { ...state, conditions: state.conditions.map(cloneCondition) }; }
function validString(value: unknown, min: number, max: number): value is string { return typeof value === "string" && value.length >= min && value.length <= max; }
function invalid(code: string, message: string): { ok: false; code: string; message: string } { return { ok: false, code, message }; }
