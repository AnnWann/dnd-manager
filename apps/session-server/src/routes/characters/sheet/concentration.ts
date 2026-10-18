import type { SessionLoggedOperation } from "../../session/protocol";

export const CONCENTRATION_ROUTE = "characters/sheet/concentration" as const;

export function isConcentrationRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type === "character.concentration.start" || operation.type === "character.concentration.end";
}
