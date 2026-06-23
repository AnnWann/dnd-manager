import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"
import {
  prepareInventoryItemForInsert,
  removeSingleInventoryItem,
  updateSingleInventoryItem,
} from "../items/inventoryIdentity"

export function addInventoryItem(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  const inventory = character.get("inventory")

  return character.with("inventory", [
    ...inventory,
    prepareInventoryItemForInsert(item, inventory),
  ])
}

export function updateInventoryItem(
  character: CharacterTemplate,
  itemId: string,
  updater: (item: Itemmable) => Itemmable,
): CharacterTemplate {
  return character.with(
    "inventory",
    updateSingleInventoryItem(
      character.get("inventory"),
      itemId,
      updater,
    ),
  )
}

export function removeInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  return character.with(
    "inventory",
    removeSingleInventoryItem(character.get("inventory"), itemId),
  )
}

export function sendInventoryItemToBagOfHolding(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  return updateInventoryItem(character, itemId, (item) => ({
    ...item,
    insideBagOfHolding: true,
  }))
}

export function removeInventoryItemFromBagOfHolding(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  return updateInventoryItem(character, itemId, (item) => ({
    ...item,
    insideBagOfHolding: false,
  }))
}

export function toggleInventoryItemBagOfHolding(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  return updateInventoryItem(character, itemId, (item) => ({
    ...item,
    insideBagOfHolding: !item.insideBagOfHolding,
  }))
}
