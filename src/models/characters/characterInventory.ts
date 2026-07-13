import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"
import {
  prepareInventoryItemForInsert,
  removeSingleInventoryItem,
  updateSingleInventoryItem,
} from "../items/inventoryIdentity"

export const MAX_ATTUNED_ITEMS = 3

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
    updateSingleInventoryItem(character.get("inventory"), itemId, (item) => {
      const updatedItem = updater(item)
      const canRemainAttuned =
        updatedItem.magicItem === true &&
        updatedItem.requiresAttunement === true

      return canRemainAttuned
        ? updatedItem
        : {
            ...updatedItem,
            attuned: false,
          }
    }),
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

export function toggleInventoryItemAttunement(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const inventory = character.get("inventory")
  const item = inventory.find((entry) => entry.id === itemId)

  if (!item?.magicItem || !item.requiresAttunement) return character

  const attunedCount = inventory.filter((entry) => entry.attuned === true).length

  if (!item.attuned && attunedCount >= MAX_ATTUNED_ITEMS) {
    return character
  }

  return character.with(
    "inventory",
    updateSingleInventoryItem(inventory, itemId, (current) => ({
      ...current,
      attuned: !current.attuned,
    })),
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
