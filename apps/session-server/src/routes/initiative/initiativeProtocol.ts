import { DAMAGE_TYPES, type DamageType } from "../../../../web/src/models/combat/Damage";

import type { InitiativeDamagePart as SharedDamagePart, SessionInitiativeOperation as SharedInitiativeOperation } from "../../../../../packages/session-protocol/src/initiativeOperations"
import type { InitiativeHpApplicationResult } from "../../../../../packages/session-protocol/src/initiativeHp"
export type { InitiativeHpApplicationResult } from "../../../../../packages/session-protocol/src/initiativeHp"
export type InitiativeDamagePart = SharedDamagePart<DamageType>
export type SessionInitiativeOperation = SharedInitiativeOperation<DamageType>

export type SessionInitiativeState = {
  initialized: boolean;
  revision: number;
  session: Record<string, unknown>;
};

export type SessionInitiativeClientMessage =
  | { type: "session.initiative.initialize"; session: Record<string, unknown> }
  | { type: "session.initiative.operation"; operation: SessionInitiativeOperation };

export function parseInitiativeClientMessage(raw: string): SessionInitiativeClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;

  if (value.type === "session.initiative.initialize") {
    return isRecord(value.session) ? value as SessionInitiativeClientMessage : null;
  }
  if (value.type !== "session.initiative.operation" || !isRecord(value.operation)) return null;
  const operation = value.operation;
  if (operation.characterId !== "session" || typeof operation.type !== "string") return null;

  switch (operation.type) {
    case "initiative.entries.add": return Array.isArray(operation.entries) && operation.entries.every(isRecord) ? value as SessionInitiativeClientMessage : null;
    case "initiative.entry.update": return readId(operation.entryId) && isRecord(operation.patch) ? value as SessionInitiativeClientMessage : null;
    case "initiative.entry.remove": return readId(operation.entryId) ? value as SessionInitiativeClientMessage : null;
    case "initiative.allies.trade": return readId(operation.entryId) && operation.direction === 1 ? value as SessionInitiativeClientMessage : null;
    case "initiative.viewMode.set": return operation.viewMode === "table" || operation.viewMode === "cards" ? value as SessionInitiativeClientMessage : null;
    case "initiative.settings.update": return isRecord(operation.patch) ? value as SessionInitiativeClientMessage : null;
    case "initiative.deathSaves.set": return readId(operation.entryId) && integerRange(operation.successes, 0, 3) && integerRange(operation.failures, 0, 3) ? value as SessionInitiativeClientMessage : null;
    case "initiative.conditions.bulk":
      return Array.isArray(operation.entryIds)
        && operation.entryIds.length > 0
        && operation.entryIds.length <= 50
        && operation.entryIds.every((entryId) => Boolean(readId(entryId)))
        && (operation.mode === "add" || operation.mode === "remove")
        && (operation.mode !== "add" || isRecord(operation.condition))
        && (operation.mode !== "remove" || Boolean(readId(operation.conditionName)))
        ? value as SessionInitiativeClientMessage
        : null;
    case "initiative.hp.apply": {
      if (!validTargets(operation.entryIds)) return null;
      if (operation.mode === "damage") {
        return Array.isArray(operation.parts)
          && operation.parts.length > 0
          && operation.parts.length <= 10
          && operation.parts.every((part) => isRecord(part)
            && positiveInteger(part.amount)
            && (part.damageType === undefined || DAMAGE_TYPES.includes(part.damageType as DamageType))
            && (part.magical === undefined || typeof part.magical === "boolean"))
          ? value as SessionInitiativeClientMessage
          : null;
      }
      if (operation.mode === "heal" || operation.mode === "temporary") {
        return positiveInteger(operation.amount)
          ? value as SessionInitiativeClientMessage
          : null;
      }
      return null;
    }
    case "initiative.customAction.execute":
      return Boolean(readId(operation.systemId))
        && Boolean(readId(operation.actionId))
        && Array.isArray(operation.entryIds)
        && operation.entryIds.length > 0
        && operation.entryIds.length <= 50
        && operation.entryIds.every((entryId) => Boolean(readId(entryId)))
        ? value as SessionInitiativeClientMessage
        : null;
    case "initiative.sort":
    case "initiative.combat.start":
    case "initiative.combat.end":
    case "initiative.turn.next":
    case "initiative.turn.previous":
    case "initiative.reset":
      return value as SessionInitiativeClientMessage;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function readId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validTargets(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 50
    && value.every((entryId) => Boolean(readId(entryId)));
}
function positiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1_000_000;
}

function integerRange(value: unknown, minimum: number, maximum: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
