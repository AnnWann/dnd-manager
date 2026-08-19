import type { EquippedItemDestination, EquippedItemReference } from "../../models/characters/characterEquippedItemMovement"

export type SessionEquipmentOperation =
  | {
      type: "character.equipment.item.update"
      characterId: string
      reference: EquippedItemReference
      item: Record<string, unknown>
    }
  | {
      type: "character.equipment.move"
      characterId: string
      reference: EquippedItemReference
      destination: Exclude<EquippedItemDestination, "ground">
    }
  | {
      type: "character.equipment.attunement.toggle"
      characterId: string
      itemId: string
    }
  | {
      type: "character.equipment.pocket.unequip"
      characterId: string
      index: number
    }
  | {
      type: "character.equipment.pocket.wield"
      characterId: string
      index: number
    }
  | {
      type: "character.equipment.pocket.use"
      characterId: string
      index: number
    }

export type SessionEquipmentClientMessage = {
  type: "session.equipment.operation"
  operation: SessionEquipmentOperation
}
