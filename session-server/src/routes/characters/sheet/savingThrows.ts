import type { SessionLoggedOperation } from "../../../protocol";

export const SAVING_THROWS_ROUTE = "characters/sheet/saving-throws" as const;

export function isSavingThrowsRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type === "character.savingThrow.set";
}
