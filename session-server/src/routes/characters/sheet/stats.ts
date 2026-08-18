import type { SessionLoggedOperation } from "../../../protocol";

export type StatSheetRoute =
  | "characters/sheet/stats/armor-class"
  | "characters/sheet/stats/initiative"
  | "characters/sheet/stats/mobility"
  | "characters/sheet/stats/passive-perception"
  | "characters/sheet/stats/exhaustion"
  | "characters/sheet/stats/inspiration"
  | "characters/sheet/stats/experience";

export function statRouteForOperation(operation: SessionLoggedOperation): StatSheetRoute | null {
  switch (operation.type) {
    case "character.stat.armorClass.set": return "characters/sheet/stats/armor-class";
    case "character.stat.initiative.set": return "characters/sheet/stats/initiative";
    case "character.stat.mobility.set": return "characters/sheet/stats/mobility";
    case "character.stat.passivePerception.set": return "characters/sheet/stats/passive-perception";
    case "character.stat.exhaustion.set": return "characters/sheet/stats/exhaustion";
    case "character.stat.inspiration.set": return "characters/sheet/stats/inspiration";
    case "character.stat.experience.set": return "characters/sheet/stats/experience";
    default: return null;
  }
}
