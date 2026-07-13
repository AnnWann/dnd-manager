import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"
import {
  prepareInventoryItemForInsert,
  removeSingleInventoryItem,
  updateSingleInventoryItem,
} from "../items/inventoryIdentity"

export const MAX_ATTUNED_ITEMS = 3

export function getCharacterCarriedItems(
  character: CharacterTemplate,
): Itemmable[] {
  const equipment = character.get("equipment")

  return [
    ...character.get("inventory"),
    equipment.armor,
    equipment.boots,
    equipment.helmet,
    equipment.gloves,
    equipment.cape,
    equipment.shield,
    ...equipment.rings,
    ...equipment.weapons,
    ...equipment.pockets,
  ].filter((item): item is Itemmable => Boolean(item))
}

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
  const item = getCharacterCarriedItems(character).find(
    (entry) => entry.id === itemId,
  )

  if (!item?.magicItem || !item.requiresAttunement) return character

  const attunedCount = getCharacterCarriedItems(character).filter(
    (entry) => entry.attuned === true,
  ).length

  if (!item.attuned && attunedCount >= MAX_ATTUNED_ITEMS) {
    return character
  }

  const inventory = character.get("inventory")
  if (inventory.some((entry) => entry.id === itemId)) {
    return character.with(
      "inventory",
      updateSingleInventoryItem(inventory, itemId, (current) => ({
        ...current,
        attuned: !current.attuned,
      })),
    )
  }

  const equipment = character.get("equipment")

  return character.with("equipment", {
    ...equipment,
    armor: patchItemAttunement(equipment.armor, itemId),
    boots: patchItemAttunement(equipment.boots, itemId),
    helmet: patchItemAttunement(equipment.helmet, itemId),
    gloves: patchItemAttunement(equipment.gloves, itemId),
    cape: patchItemAttunement(equipment.cape, itemId),
    shield: patchItemAttunement(equipment.shield, itemId),
    rings: equipment.rings.map((entry) =>
      patchItemAttunement(entry, itemId),
    ),
    weapons: equipment.weapons.map((entry) =>
      patchItemAttunement(entry, itemId),
    ),
    pockets: equipment.pockets.map((entry) =>
      patchItemAttunement(entry, itemId),
    ),
  })
}

function patchItemAttunement<T extends Itemmable | undefined>(
  item: T,
  itemId: string,
): T {
  if (!item || item.id !== itemId) return item

  return {
    ...item,
    attuned: !item.attuned,
  } as T
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
