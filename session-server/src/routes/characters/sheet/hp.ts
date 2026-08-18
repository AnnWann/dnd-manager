import type { SessionLoggedOperation } from "../../../protocol";

export const HP_ROUTE = "characters/sheet/hp" as const;

export function isHpRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type.startsWith("character.hp.") && operation.type !== "character.hp.undo";
}
