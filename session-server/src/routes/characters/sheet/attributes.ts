import type { SessionLoggedOperation } from "../../../protocol";

export const ATTRIBUTES_ROUTE = "characters/sheet/attributes" as const;

export function isAttributesRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type === "character.attribute.set";
}
