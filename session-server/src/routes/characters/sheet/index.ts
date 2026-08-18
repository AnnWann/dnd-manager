import {
  parseClientSessionMessage,
  type SessionLoggedOperation,
} from "../../../protocol";
import { ATTRIBUTES_ROUTE, isAttributesRouteOperation } from "./attributes";
import { CONDITIONS_ROUTE, isConditionsRouteOperation } from "./conditions";
import { HIT_DICE_ROUTE, isHitDiceRouteOperation } from "./hitDice";
import { HP_ROUTE, isHpRouteOperation } from "./hp";
import { REST_ROUTE, isRestRouteOperation } from "./rest";
import { SAVING_THROWS_ROUTE, isSavingThrowsRouteOperation } from "./savingThrows";
import { SKILLS_ROUTE, isSkillsRouteOperation } from "./skills";
import { statRouteForOperation, type StatSheetRoute } from "./stats";

export type CharacterSheetRoute =
  | typeof HP_ROUTE
  | typeof HIT_DICE_ROUTE
  | StatSheetRoute
  | typeof ATTRIBUTES_ROUTE
  | typeof SAVING_THROWS_ROUTE
  | typeof SKILLS_ROUTE
  | typeof CONDITIONS_ROUTE
  | typeof REST_ROUTE;

export type SessionSheetOperationMessage = {
  type: "session.sheet.operation";
  route: CharacterSheetRoute;
  operation: SessionLoggedOperation;
};

export function routeForSheetOperation(operation: SessionLoggedOperation): CharacterSheetRoute {
  if (isHpRouteOperation(operation)) return HP_ROUTE;
  if (isHitDiceRouteOperation(operation)) return HIT_DICE_ROUTE;
  const statRoute = statRouteForOperation(operation);
  if (statRoute) return statRoute;
  if (isAttributesRouteOperation(operation)) return ATTRIBUTES_ROUTE;
  if (isSavingThrowsRouteOperation(operation)) return SAVING_THROWS_ROUTE;
  if (isSkillsRouteOperation(operation)) return SKILLS_ROUTE;
  if (isConditionsRouteOperation(operation)) return CONDITIONS_ROUTE;
  if (isRestRouteOperation(operation)) return REST_ROUTE;
  throw new Error(`No character sheet route registered for operation ${operation.type}.`);
}

export function parseSheetOperationMessage(raw: string): SessionSheetOperationMessage | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.type !== "session.sheet.operation" || typeof value.route !== "string" || !isRecord(value.operation)) return null;

  const operation = parseOperationWithExistingValidators(value.operation);
  if (!operation) return null;

  let expectedRoute: CharacterSheetRoute;
  try { expectedRoute = routeForSheetOperation(operation); }
  catch { return null; }

  if (value.route !== expectedRoute) return null;
  return { type: "session.sheet.operation", route: expectedRoute, operation };
}

function parseOperationWithExistingValidators(operation: Record<string, unknown>): SessionLoggedOperation | null {
  const type = typeof operation.type === "string" ? operation.type : "";
  const legacyType = type.startsWith("character.condition.")
    ? "session.conditions.operation"
    : "session.hp.operation";
  const parsed = parseClientSessionMessage(JSON.stringify({ type: legacyType, operation }));
  if (!parsed) return null;
  if (parsed.type === "session.hp.operation" || parsed.type === "session.conditions.operation") return parsed.operation;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
