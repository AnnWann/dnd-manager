import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type { CustomResourceState } from "../../models/customSystems/CustomSystemDefinition"

export type SessionCustomSystemOperation =
  | { type: "character.customSystem.field.set"; characterId: string; systemId: string; fieldId: string; value: JsonValue }
  | { type: "character.customSystem.field.remove"; characterId: string; systemId: string; fieldId: string }
  | { type: "character.customSystem.resource.set"; characterId: string; systemId: string; resourceId: string; state: CustomResourceState }
  | { type: "character.customSystem.resource.adjust"; characterId: string; systemId: string; resourceId: string; amount: number }
  | { type: "character.customSystem.resource.reset"; characterId: string; systemId: string; resourceId: string }

export type SessionCustomSystemClientMessage = {
  type: "session.customSystem.operation"
  operation: SessionCustomSystemOperation
}
