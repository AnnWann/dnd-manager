import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"

export function addInventoryItem(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  return character.with("inventory", [
    ...character.get("inventory"),
    item,
  ])
}

export function updateInventoryItem(
  character: CharacterTemplate,
  itemId: string,
  updater: (item: Itemmable) => Itemmable,
): CharacterTemplate {
  return character.with(
    "inventory",
    character.get("inventory").map((item) =>
      item.id === itemId ? updater(item) : item,
    ),
  )
}

export function removeInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  return character.with(
    "inventory",
    character.get("inventory").filter(
      (item) => item.id !== itemId,
    ),
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