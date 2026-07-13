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
  const inventory = updateSingleInventoryItem(
    character.get("inventory"),
    itemId,
    updater,
  )
  const updatedItem = inventory.find((item) => item.id === itemId)
  const equipment = character.get("equipment")
  const shouldRemainAttuned =
    updatedItem?.magicItem === true && updatedItem.requiresAttunement === true

  return character
    .with("inventory", inventory)
    .with("equipment", {
      ...equipment,
      attunedItemIds: shouldRemainAttuned
        ? equipment.attunedItemIds ?? []
        : (equipment.attunedItemIds ?? []).filter((id) => id !== itemId),
    })
}

export function removeInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const equipment = character.get("equipment")

  return character
    .with(
      "inventory",
      removeSingleInventoryItem(character.get("inventory"), itemId),
    )
    .with("equipment", {
      ...equipment,
      attunedItemIds: (equipment.attunedItemIds ?? []).filter(
        (id) => id !== itemId,
      ),
    })
}

export function toggleInventoryItemAttunement(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const item = character
    .get("inventory")
    .find((entry) => entry.id === itemId)

  if (!item?.magicItem || !item.requiresAttunement) return character

  const equipment = character.get("equipment")
  const attunedItemIds = equipment.attunedItemIds ?? []
  const isAttuned = attunedItemIds.includes(itemId)

  if (!isAttuned && attunedItemIds.length >= MAX_ATTUNED_ITEMS) {
    return character
  }

  return character.with("equipment", {
    ...equipment,
    attunedItemIds: isAttuned
      ? attunedItemIds.filter((id) => id !== itemId)
      : [...attunedItemIds, itemId],
  })
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
