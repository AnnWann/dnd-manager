import type {
  SessionConnection,
  SessionHpLogRecord,
  SessionHpOperation,
  SessionHpState,
} from "./protocol";

export const MAX_HP_LOG_RECORDS = 100;

export type HpApplyResult =
  | { ok: true; next: SessionHpState; record: SessionHpLogRecord }
  | { ok: false; code: string; message: string };

export function normalizeHpSeed(state: Omit<SessionHpState, "revision">): SessionHpState {
  const max = Math.max(1, integer(state.max));
  const currentMax = clamp(integer(state.currentMax), 1, max);
  const maxHpBonus = integer(state.maxHpBonus);
  const effectiveMax = Math.max(1, currentMax + maxHpBonus);

  return {
    characterId: state.characterId,
    ownerUserId: state.ownerUserId?.trim() || undefined,
    current: clamp(integer(state.current), 0, effectiveMax),
    temporary: Math.max(0, integer(state.temporary)),
    max,
    currentMax,
    maxHpBonus,
    revision: 0,
  };
}

export function applyHpOperation(
  previous: SessionHpState,
  operation: SessionHpOperation,
  connection: SessionConnection,
): HpApplyResult {
  const permissionError = validatePermission(previous, connection);
  if (permissionError) return permissionError;

  const validationError = validateOperation(operation, previous.characterId);
  if (validationError) return validationError;

  const before = cloneHp(previous);
  const next = mutateHp(previous, operation);
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
        type: "character.hp.restore",
        characterId: previous.characterId,
        hp: before,
      },
    },
  };
}

export function applyHpUndo(
  current: SessionHpState,
  source: SessionHpLogRecord,
  connection: SessionConnection,
): HpApplyResult {
  if (connection.role !== "MASTER") {
    return {
      ok: false,
      code: "MASTER_REQUIRED",
      message: "Only the MASTER can undo session changes.",
    };
  }

  if (source.undoneAt) {
    return {
      ok: false,
      code: "ALREADY_UNDONE",
      message: "This change has already been undone.",
    };
  }

  if (source.reverseOperation.characterId !== current.characterId) {
    return {
      ok: false,
      code: "UNDO_TARGET_MISMATCH",
      message: "Undo target does not match the current HP state.",
    };
  }

  const beforeUndo = cloneHp(current);
  const restored = cloneHp(source.reverseOperation.hp);
  restored.revision = current.revision + 1;

  return {
    ok: true,
    next: restored,
    record: {
      id: crypto.randomUUID(),
      actorId: connection.userId,
      createdAt: new Date().toISOString(),
      operation: {
        type: "character.hp.undo",
        characterId: current.characterId,
        sourceLogId: source.id,
      },
      reverseOperation: {
        type: "character.hp.restore",
        characterId: current.characterId,
        hp: beforeUndo,
      },
    },
  };
}

function validatePermission(
  state: SessionHpState,
  connection: SessionConnection,
): { ok: false; code: string; message: string } | null {
  if (connection.role === "MASTER") return null;

  if (state.ownerUserId && state.ownerUserId === connection.userId) return null;

  return {
    ok: false,
    code: "HP_FORBIDDEN",
    message: "Players may only change HP for characters they own.",
  };
}

function validateOperation(
  operation: SessionHpOperation,
  characterId: string,
): { ok: false; code: string; message: string } | null {
  if (operation.characterId !== characterId) {
    return {
      ok: false,
      code: "CHARACTER_MISMATCH",
      message: "HP operation target does not match the loaded character.",
    };
  }

  const hasValidAmount = "amount" in operation
    ? Number.isFinite(operation.amount) && Number.isInteger(operation.amount)
    : true;
  const hasValidValue = "value" in operation
    ? Number.isFinite(operation.value) && Number.isInteger(operation.value)
    : true;

  if (!hasValidAmount || !hasValidValue) {
    return {
      ok: false,
      code: "INVALID_HP_VALUE",
      message: "HP values must be finite integers.",
    };
  }

  switch (operation.type) {
    case "character.hp.damage":
    case "character.hp.heal":
    case "character.hp.temporary.add":
      if (operation.amount <= 0) {
        return {
          ok: false,
          code: "INVALID_HP_AMOUNT",
          message: "HP change amount must be greater than zero.",
        };
      }
      break;
    case "character.hp.currentMax.adjust":
      if (operation.amount === 0) {
        return {
          ok: false,
          code: "INVALID_HP_AMOUNT",
          message: "Maximum HP adjustment cannot be zero.",
        };
      }
      break;
    case "character.hp.set":
    case "character.hp.temporary.set":
      if (operation.value < 0) {
        return {
          ok: false,
          code: "INVALID_HP_VALUE",
          message: "HP cannot be negative.",
        };
      }
      break;
    case "character.hp.max.set":
      if (operation.value < 1) {
        return {
          ok: false,
          code: "INVALID_HP_MAX",
          message: "Maximum HP must be at least 1.",
        };
      }
      break;
    case "character.hp.rest":
      if (operation.fraction !== 0.5 && operation.fraction !== 1) {
        return {
          ok: false,
          code: "INVALID_REST_FRACTION",
          message: "HP rest recovery fraction must be 0.5 or 1.",
        };
      }
      break;
  }

  return null;
}

function mutateHp(
  previous: SessionHpState,
  operation: SessionHpOperation,
): SessionHpState {
  const next = cloneHp(previous);

  switch (operation.type) {
    case "character.hp.set":
      next.current = clamp(operation.value, 0, effectiveMax(next));
      break;

    case "character.hp.temporary.set":
      next.temporary = Math.max(0, operation.value);
      break;

    case "character.hp.temporary.add":
      next.temporary = Math.max(0, next.temporary + operation.amount);
      break;

    case "character.hp.damage": {
      let remaining = operation.amount;
      const absorbed = Math.min(next.temporary, remaining);
      next.temporary -= absorbed;
      remaining -= absorbed;
      next.current = Math.max(0, next.current - remaining);
      break;
    }

    case "character.hp.heal":
      next.current = Math.min(effectiveMax(next), next.current + operation.amount);
      break;

    case "character.hp.max.set": {
      const previousRealMax = Math.max(1, next.max);
      const hadReduction = next.currentMax < previousRealMax;
      next.max = Math.max(1, operation.value);
      next.currentMax = hadReduction
        ? Math.min(next.max, next.currentMax)
        : next.max;
      next.current = Math.min(next.current, effectiveMax(next));
      break;
    }

    case "character.hp.currentMax.adjust":
      next.currentMax = clamp(next.currentMax + operation.amount, 1, next.max);
      next.current = Math.min(next.current, effectiveMax(next));
      break;

    case "character.hp.currentMax.restore":
      next.currentMax = next.max;
      next.current = Math.min(next.current, effectiveMax(next));
      break;

    case "character.hp.rest": {
      const maximum = effectiveMax(next);
      const missing = Math.max(0, maximum - next.current);
      next.current = Math.min(
        maximum,
        next.current + Math.ceil(missing * operation.fraction),
      );
      next.temporary = 0;
      break;
    }
  }

  return next;
}

function effectiveMax(state: SessionHpState): number {
  return Math.max(1, state.currentMax + state.maxHpBonus);
}

function cloneHp(state: SessionHpState): SessionHpState {
  return { ...state };
}

function integer(value: number): number {
  return Math.trunc(Number(value) || 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
