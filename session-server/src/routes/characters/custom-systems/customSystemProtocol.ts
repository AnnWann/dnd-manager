import type { JsonValue } from "../../../../../src/models/customSystems/CustomGenerals";
import type { CustomResourceState } from "../../../../../src/models/customSystems/CustomSystemDefinition";

export type SessionCustomSystemOperation =
  | { type: "character.customSystem.field.set"; characterId: string; systemId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.field.remove"; characterId: string; systemId: string; fieldId: string }
  | { type: "character.customSystem.resource.set"; characterId: string; systemId: string; resourceId: string; state: CustomResourceState }
  | { type: "character.customSystem.resource.adjust"; characterId: string; systemId: string; resourceId: string; amount: number }
  | { type: "character.customSystem.resource.reset"; characterId: string; systemId: string; resourceId: string };

export type SessionCustomSystemClientMessage = {
  type: "session.customSystem.operation";
  operation: SessionCustomSystemOperation;
};

export function parseCustomSystemClientMessage(raw: string): SessionCustomSystemClientMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.type !== "session.customSystem.operation" || !isOperation(value.operation)) return null;
  return { type: "session.customSystem.operation", operation: value.operation };
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
      return nonEmpty(value.resourceId) && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount !== 0;
    case "character.customSystem.resource.reset":
      return nonEmpty(value.resourceId);
    default:
      return false;
  }
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

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
