import type { SessionLoggedOperation } from "../../../protocol";

export const REST_ROUTE = "characters/sheet/rest" as const;

export function isRestRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type === "character.rest.short" || operation.type === "character.rest.long";
}
