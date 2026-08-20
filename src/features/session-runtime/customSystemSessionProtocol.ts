import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type {
  CustomAbilityInstance,
  CustomResourceState,
} from "../../models/customSystems/CustomSystemDefinition"

export type SessionCustomSystemOperation =
  | { type: "character.customSystem.field.set"; characterId: string; systemId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.field.remove"; characterId: string; systemId: string; fieldId: string }
  | { type: "character.customSystem.resource.set"; characterId: string; systemId: string; resourceId: string; state: CustomResourceState }
  | { type: "character.customSystem.resource.adjust"; characterId: string; systemId: string; resourceId: string; amount: number }
  | { type: "character.customSystem.resource.reset"; characterId: string; systemId: string; resourceId: string }
  | { type: "character.customSystem.ability.add"; characterId: string; systemId: string; ability: CustomAbilityInstance }
  | { type: "character.customSystem.ability.remove"; characterId: string; systemId: string; abilityId: string }
  | { type: "character.customSystem.ability.field.set"; characterId: string; systemId: string; abilityId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.ability.learned.set"; characterId: string; systemId: string; abilityId: string; learned: boolean }
  | { type: "character.customSystem.ability.prepared.set"; characterId: string; systemId: string; abilityId: string; prepared: boolean }
  | { type: "character.customSystem.ability.usage.set"; characterId: string; systemId: string; abilityId: string; used: number }
  | { type: "character.customSystem.ability.activate"; characterId: string; systemId: string; abilityId: string }
  | { type: "character.customSystem.action.execute"; characterId: string; systemId: string; actionId: string }
  | { type: "character.customSystem.automation.execute"; characterId: string; systemId: string; automationId: string }

export type SessionCustomSystemClientMessage = {
  type: "session.customSystem.operation"
  operation: SessionCustomSystemOperation
}
