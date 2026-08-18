import type { SessionLoggedOperation } from "./sessionProtocol"

export type CharacterSheetRoute =
  | "characters/sheet/hp"
  | "characters/sheet/hitdice"
  | "characters/sheet/stats/armor-class"
  | "characters/sheet/stats/initiative"
  | "characters/sheet/stats/mobility"
  | "characters/sheet/stats/passive-perception"
  | "characters/sheet/stats/exhaustion"
  | "characters/sheet/stats/inspiration"
  | "characters/sheet/stats/experience"
  | "characters/sheet/attributes"
  | "characters/sheet/saving-throws"
  | "characters/sheet/skills"
  | "characters/sheet/conditions"
  | "characters/sheet/rest"

export type SessionSheetOperationMessage = {
  type: "session.sheet.operation"
  route: CharacterSheetRoute
  operation: SessionLoggedOperation
}

export function routeForSheetOperation(operation: SessionLoggedOperation): CharacterSheetRoute {
  if (operation.type.startsWith("character.hp.")) return "characters/sheet/hp"
  if (operation.type.startsWith("character.hitDice.")) return "characters/sheet/hitdice"

  switch (operation.type) {
    case "character.stat.armorClass.set": return "characters/sheet/stats/armor-class"
    case "character.stat.initiative.set": return "characters/sheet/stats/initiative"
    case "character.stat.mobility.set": return "characters/sheet/stats/mobility"
    case "character.stat.passivePerception.set": return "characters/sheet/stats/passive-perception"
    case "character.stat.exhaustion.set": return "characters/sheet/stats/exhaustion"
    case "character.stat.inspiration.set": return "characters/sheet/stats/inspiration"
    case "character.stat.experience.set": return "characters/sheet/stats/experience"
    case "character.attribute.set": return "characters/sheet/attributes"
    case "character.savingThrow.set": return "characters/sheet/saving-throws"
    case "character.skill.set": return "characters/sheet/skills"
    case "character.condition.add":
    case "character.condition.update":
    case "character.condition.remove": return "characters/sheet/conditions"
    case "character.rest.short":
    case "character.rest.long": return "characters/sheet/rest"
    default: throw new Error(`No character sheet route registered for operation ${operation.type}.`)
  }
}

export function toSheetOperationMessage(operation: SessionLoggedOperation): SessionSheetOperationMessage {
  return {
    type: "session.sheet.operation",
    route: routeForSheetOperation(operation),
    operation,
  }
}
