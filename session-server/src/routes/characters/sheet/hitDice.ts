import type { SessionLoggedOperation } from "../../session/protocol";

export const HIT_DICE_ROUTE = "characters/sheet/hitdice" as const;

export function isHitDiceRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type.startsWith("character.hitDice.");
}
