import type { JsonValue } from "../../../../../src/models/customSystems/CustomGenerals";
import type {
  CustomAbilityInstance,
  CustomResourceState,
} from "../../../../../src/models/customSystems/CustomSystemDefinition";

export type SessionCustomSystemOperation =
  | { type: "character.customSystem.field.set"; characterId: string; systemId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.field.remove"; characterId: string; systemId: string; fieldId: string }
  | { type: "character.customSystem.resource.set"; characterId: string; systemId: string; resourceId: string; state: CustomResourceState }
  | { type: "character.customSystem.resource.adjust"; characterId: string; systemId: string; resourceId: string; amount: number }
  | { type: "character.customSystem.resource.reset"; characterId: string; systemId: string; resourceId: string }
  | { type: "character.customSystem.ability.add"; characterId: string; systemId: string; ability: CustomAbilityInstance }
  | { type: "character.customSystem.ability.remove"; characterId: string; systemId: string; abilityId: string }
  | { type: "character.customSystem.ability.field.set"; characterId: string; systemId: string; abilityId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.ability.learned.set"; characterId: string; systemId: string; abilityId: string; learned: boolean }
  | { type: "character.customSystem.ability.prepared.set"; characterId: string; systemId: string; abilityId: string; prepared: boolean }
  | { type: "character.customSystem.ability.usage.set"; characterId: string; systemId: string; abilityId: string; used: number }
  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string }
  | { type: "character.customSystem.action.execute"; characterId: string; systemId: string; actionId: string };

export type SessionCustomSystemClientMessage = {
  type: "session.customSystem.operation" | "session.abilities.operation";
  operation: SessionCustomSystemOperation;
};

export function parseCustomSystemClientMessage(raw: string): SessionCustomSystemClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  if (value.type !== "session.customSystem.operation" && value.type !== "session.abilities.operation") return null;
  if (!isOperation(value.operation)) return null;
  return { type: value.type, operation: value.operation };
}

function isOperation(value: unknown): value is SessionCustomSystemOperation {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.characterId) || !nonEmpty(value.systemId)) return false;
  switch (value.type) {
    case "character.customSystem.field.set":
      return nonEmpty(value.fieldId) && isJsonValue(value.value);
    case "character.customSystem.field.remove":
      return nonEmpty(value.fieldId);
    case "character.customSystem.resource.set":
      return nonEmpty(value.resourceId) && isResourceState(value.state);
    case "character.customSystem.resource.adjust":
      return nonEmpty(value.resourceId) && finiteNonZero(value.amount);
    case "character.customSystem.resource.reset":
      return nonEmpty(value.resourceId);
    case "character.customSystem.ability.add":
      return isAbility(value.ability);
    case "character.customSystem.ability.remove":
    case "character.customSystem.ability.activate":
      return nonEmpty(value.abilityId);
    case "character.customSystem.ability.field.set":
      return nonEmpty(value.abilityId) && nonEmpty(value.fieldId) && isJsonValue(value.value);
    case "character.customSystem.ability.learned.set":
      return nonEmpty(value.abilityId) && typeof value.learned === "boolean";
    case "character.customSystem.ability.prepared.set":
      return nonEmpty(value.abilityId) && typeof value.prepared === "boolean";
    case "character.customSystem.ability.usage.set":
      return nonEmpty(value.abilityId) && nonNegativeInteger(value.used);
    case "character.customSystem.action.execute":
      return nonEmpty(value.actionId);
    default:
      return false;
  }
}

function isAbility(value: unknown): value is CustomAbilityInstance {
  if (!isRecord(value) || !nonEmpty(value.id) || !nonEmpty(value.abilityTypeId) || !isRecord(value.values)) return false;
  if (!Object.values(value.values).every(isJsonValue)) return false;
  if (value.predefinedAbilityId !== undefined && !nonEmpty(value.predefinedAbilityId)) return false;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return false;
  if (value.learned !== undefined && typeof value.learned !== "boolean") return false;
  if (value.prepared !== undefined && typeof value.prepared !== "boolean") return false;
  if (value.usage !== undefined) {
    if (!isRecord(value.usage) || !nonNegativeInteger(value.usage.used)) return false;
    if (value.usage.maximum !== undefined && !nonNegativeInteger(value.usage.maximum)) return false;
  }
  return true;
}

function isResourceState(value: unknown): value is CustomResourceState {
  if (!isRecord(value) || typeof value.current !== "number" || !Number.isFinite(value.current)) return false;
  return (value.maximum === undefined || (typeof value.maximum === "number" && Number.isFinite(value.maximum)))
    && (value.temporary === undefined || (typeof value.temporary === "number" && Number.isFinite(value.temporary)));
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function finiteNonZero(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
