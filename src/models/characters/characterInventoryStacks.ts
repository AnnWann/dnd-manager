import type { CharacterTemplate } from "./CharacterTemplate"
import type { EquipmentDestination } from "./characterEquipmentInteractions"
import type { Itemmable } from "../items/item"
import { canItemGoInPocket } from "../items/itemPocketability"

const EQUIPMENT_STATE_FIELDS = new Set([
  "id",
  "quantity",
  "insideBagOfHolding",
  "heldHands",
  "wieldedTwoHanded",
])

function comparableItem(item: Itemmable): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key]) => !EQUIPMENT_STATE_FIELDS.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function itemsShareStack(left: Itemmable, right: Itemmable): boolean {
  return JSON.stringify(comparableItem(left)) === JSON.stringify(comparableItem(right))
}

export function mergeItemIntoInventory(
  inventory: Itemmable[],
  item: Itemmable,
): Itemmable[] {
  const quantity = Math.max(1, Math.trunc(item.quantity ?? 1))
  const index = inventory.findIndex((entry) => itemsShareStack(entry, item))

  if (index < 0) {
    return [
      ...inventory,
      {
        ...item,
        quantity,
        heldHands: undefined,
        wieldedTwoHanded: undefined,
        insideBagOfHolding: false,
      },
    ]
  }

  return inventory.map((entry, currentIndex) =>
    currentIndex === index
      ? {
          ...entry,
          quantity: Math.max(1, Math.trunc(entry.quantity ?? 1)) + quantity,
        }
      : entry,
  )
}

export function equipInventoryStackWithRules(
  character: CharacterTemplate,
  itemId: string,
  destination: EquipmentDestination,
): CharacterTemplate | null {
  const inventory = character.get("inventory")
  const itemIndex = inventory.findIndex((entry) => entry.id === itemId)
  const item = inventory[itemIndex]

  if (!item || Math.max(1, Math.trunc(item.quantity ?? 1)) <= 1) return null

  const equipment = character.get("equipment")
  const inventoryWithoutItem = [
    ...inventory.slice(0, itemIndex),
    ...inventory.slice(itemIndex + 1),
  ]

  if (destination.type === "pocket") {
    if (!canItemGoInPocket(item) || equipment.pockets.length >= 8) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        pockets: [
          ...equipment.pockets,
          {
            ...item,
            pocketable: true,
            heldHands: undefined,
            insideBagOfHolding: false,
          },
        ],
      })
  }

  if (
    destination.type === "hand" &&
    !(item.kind === "equipment" && item.equipSlot === "weapon")
  ) {
    const hands = destination.hands ?? (destination.wieldedTwoHanded ? 2 : 1)
    const usedHands =
      equipment.weapons.reduce(
        (total, weapon) => total + (weapon.wieldedTwoHanded || weapon.twoHanded ? 2 : 1),
        0,
      ) +
      (equipment.shield ? 1 : 0) +
      (equipment.heldItems ?? []).reduce(
        (total, heldItem) => total + Math.max(1, heldItem.heldHands ?? 1),
        0,
      )

    if (usedHands + hands > character.get("sheet").arms) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        heldItems: [
          ...(equipment.heldItems ?? []),
          {
            ...item,
            heldHands: hands,
            insideBagOfHolding: false,
          },
        ],
      })
  }

  return null
}

export function unequipPocketStack(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const item = equipment.pockets[index]
  if (!item) return character

  return character
    .with("equipment", {
      ...equipment,
      pockets: equipment.pockets.filter((_, currentIndex) => currentIndex !== index),
    })
    .with("inventory", mergeItemIntoInventory(character.get("inventory"), item))
}
