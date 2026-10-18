import type {
  SessionConcentrationOperation,
  SessionConcentrationReverseOperation,
  SessionCondition,
  SessionConditionsState,
  SessionConnection,
  SessionHpLogRecord,
} from "../../session/protocol";

const CONCENTRATION_TAG = "dnd-manager:concentrating";

export type ConcentrationApplyResult =
  | { ok: true; next: SessionConditionsState; record: SessionHpLogRecord }
  | { ok: false; code: string; message: string };

export function applyConcentrationOperation(
  previous: SessionConditionsState,
  operation: SessionConcentrationOperation,
  connection: SessionConnection,
  ownerUserId?: string,
): ConcentrationApplyResult {
  const permissionError = validatePermission(connection, ownerUserId);
  if (permissionError) return permissionError;
  if (!previous.initialized) return invalid("CONDITIONS_NOT_INITIALIZED", "Conditions for this character must be initialized by the MASTER first.");
  if (operation.characterId !== previous.characterId) return invalid("CHARACTER_MISMATCH", "Operation target does not match the loaded character.");

  const previousConcentration = previous.conditions.filter(isConcentrationCondition).map(cloneCondition);
  const next = cloneState(previous);
  next.conditions = next.conditions.filter((condition) => !isConcentrationCondition(condition));

  if (operation.type === "character.concentration.start") {
    const spellName = operation.spellName.trim();
    const spellIndex = operation.spellIndex.trim();
    if (!spellName || spellName.length > 200) return invalid("INVALID_CONCENTRATION_SPELL", "Concentration spell name is required and must be at most 200 characters.");
    if (!spellIndex || spellIndex.length > 500) return invalid("INVALID_CONCENTRATION_SPELL", "Concentration spell id is required and must be at most 500 characters.");
    next.conditions.push(createConcentrationCondition(spellIndex, spellName));
  } else {
    if (previousConcentration.length === 0) return invalid("NOT_CONCENTRATING", "The character is not concentrating.");
    if (operation.reason !== undefined && operation.reason !== "manual" && operation.reason !== "failed-save") {
      return invalid("INVALID_CONCENTRATION_REASON", "Concentration end reason is invalid.");
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
      reverseOperation: {
        type: "character.concentration.restore",
        characterId: previous.characterId,
        conditions: previousConcentration,
      },
    },
  };
}

export function applyConcentrationUndo(
  current: SessionConditionsState,
  source: SessionHpLogRecord,
  connection: SessionConnection,
): ConcentrationApplyResult {
  if (connection.role !== "MASTER") return invalid("MASTER_REQUIRED", "Only the MASTER can undo session changes.");
  if (source.undoneAt) return invalid("ALREADY_UNDONE", "This change has already been undone.");

  const reverse = source.reverseOperation;
  if (reverse.type !== "character.concentration.restore" || reverse.characterId !== current.characterId) {
    return invalid("UNDO_TARGET_MISMATCH", "This log entry is not a concentration operation for this character.");
  }

  const beforeUndo = current.conditions.filter(isConcentrationCondition).map(cloneCondition);
  const next = cloneState(current);
  next.conditions = [
    ...next.conditions.filter((condition) => !isConcentrationCondition(condition)),
    ...reverse.conditions.map(cloneCondition),
  ];
  next.revision = current.revision + 1;

  const undoReverse: SessionConcentrationReverseOperation = {
    type: "character.concentration.restore",
    characterId: current.characterId,
    conditions: beforeUndo,
  };

  return {
    ok: true,
    next,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: { type: "character.hp.undo", characterId: current.characterId, sourceLogId: source.id },
      reverseOperation: undoReverse,
    },
  };
}

export function isConcentrationCondition(condition: SessionCondition): boolean {
  return condition.tags.includes(CONCENTRATION_TAG) || normalize(condition.name) === "concentrando";
}

function createConcentrationCondition(spellIndex: string, spellName: string): SessionCondition {
  return {
    id: `concentration:${crypto.randomUUID()}`,
    name: "Concentrando",
    description: `Mantendo concentração em ${spellName}.`,
    behavior: "A concentração termina ao falhar em um teste de concentração, ao iniciar outra concentração ou quando o efeito for encerrado.",
    source: spellName,
    notes: `spell:${spellIndex}`,
    tags: [CONCENTRATION_TAG, "magia", "concentração"],
    duration: {
      type: "concentration",
      autoRemoveAtZero: false,
      customLabel: `Concentrando em ${spellName}`,
    },
    createdAt: new Date().toISOString(),
  };
}

function validatePermission(connection: SessionConnection, ownerUserId?: string) {
  if (connection.role === "MASTER") return null;
  if (ownerUserId && ownerUserId === connection.userId) return null;
  return invalid("CHARACTER_FORBIDDEN", "Players may only change concentration for characters they own.");
}

function cloneCondition(condition: SessionCondition): SessionCondition { return structuredClone(condition); }
function cloneState(state: SessionConditionsState): SessionConditionsState { return { ...state, conditions: state.conditions.map(cloneCondition) }; }
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}
function invalid(code: string, message: string): { ok: false; code: string; message: string } { return { ok: false, code, message }; }
