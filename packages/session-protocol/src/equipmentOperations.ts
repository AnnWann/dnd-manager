/** Shared operation envelope; application model types are injected by consumers. */
export type SessionEquipmentOperation<TReference, TDestination> =
  | {
      type: "character.equipment.item.update"
      characterId: string
      reference: TReference
      item: Record<string, unknown>
    }
  | {
      type: "character.equipment.move"
      characterId: string
      reference: TReference
      destination: Exclude<TDestination, "ground">
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
      replaceWeaponId?: string
      hands?: 1 | 2
    }
  | {
      type: "character.equipment.pocket.use"
      characterId: string
      index: number
    }

export type SessionEquipmentClientMessage<TReference, TDestination> = {
  type: "session.equipment.operation"
  operation: SessionEquipmentOperation<TReference, TDestination>
}
