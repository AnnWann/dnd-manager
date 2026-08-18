import type { SessionLoggedOperation } from "../../../protocol";

export const CONDITIONS_ROUTE = "characters/sheet/conditions" as const;

export function isConditionsRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type.startsWith("character.condition.");
}
