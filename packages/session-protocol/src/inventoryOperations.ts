import type { InventorySettingsOperation } from "./inventorySettings"

/** Wire-level inventory actions; runtime-specific item and equipment structures remain type parameters. */
export type SessionInventoryOperation<TItem, TDestination, TTransfer, TEquipped> =
  | { type: "character.inventory.item.add"; characterId: string; item: TItem }
  | { type: "character.inventory.item.update"; characterId: string; itemId: string; item: TItem }
  | { type: "character.inventory.item.remove"; characterId: string; itemId: string }
  | { type: "character.inventory.item.consume"; characterId: string; itemId: string }
  | { type: "character.inventory.item.equip"; characterId: string; itemId: string; destination: TDestination }
  | { type: "character.inventory.bag.toggle"; characterId: string; itemId: string }
  | { type: "character.inventory.currenciesBag.set"; characterId: string; insideBagOfHolding: boolean }
  | { type: "character.inventory.attunement.toggle"; characterId: string; itemId: string }
  | { type: "character.ammunition.spend"; characterId: string; weaponId: string; ammunitionKey: string; ammunitionName: string; quantity: number }
  | { type: "inventory.item.transfer"; characterId: string; request: TTransfer }
  | { type: "party.item.add"; characterId: string; item: TItem }
  | { type: "party.item.update"; characterId: string; itemId: string; item: TItem }
  | { type: "party.item.remove"; characterId: string; itemId: string }
  | InventorySettingsOperation
  | { type: "ground.item.add"; characterId: string; item: TItem }
  | { type: "ground.item.update"; characterId: string; itemId: string; item: TItem }
  | { type: "ground.item.remove"; characterId: string; itemId: string }
  | { type: "conditional.loot.resolve"; characterId: "session"; pendingId: string; drop: boolean }
  | { type: "character.equipment.move.ground"; characterId: string; reference: TEquipped }
