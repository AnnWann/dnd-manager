import type { CharacterTemplate } from "./CharacterTemplate"
import { getFreeHands, getUsedHands } from "./characterHands"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import { withShieldDefaults } from "../items/equipment/Shield"
import {
  WEAPON_PROPERTIES,
  getWeaponHandsUsed,
  hasWeaponProperty,
  isVersatileWeapon,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import { canItemGoInPocket } from "../items/itemPocketability"

export type EquipmentDestination =
  | { type: "natural" }
  | { type: "pocket" }
  | {
      type: "hand"
      hands?: 1 | 2
      /** Compatibilidade com chamadas anteriores. */
      wieldedTwoHanded?: boolean
    }

export function getUsedArmsIncludingShield(
  character: CharacterTemplate,
): number {
  return getUsedHands(character)
}

export function equipInventoryItemWithRules(
  character: CharacterTemplate,
  itemId: string,
  destination: EquipmentDestination = { type: "natural" },
): CharacterTemplate {
  const item = character
    .get("inventory")
    .find((entry) => entry.id === itemId)

  if (!item) return character

  if (destination.type === "pocket") {
    return pocketInventoryItemWithRules(character, itemId)
  }

  if (destination.type === "hand") {
    const hands =
      destination.hands ?? (destination.wieldedTwoHanded ? 2 : 1)
    return equipItemInHand(character, item, hands)
  }

  if (!item.equippable || !item.equipSlot) return character
  if (item.equipSlot === "weapon") {
    return equipItemInHand(character, item)
  }

  const equipment = character.get("equipment")
  const inventory = character.get("inventory")
  const inventoryWithoutItem = inventory.filter((entry) => entry.id !== item.id)
  const itemToEquip = {
    ...item,
    insideBagOfHolding: false,
  }

  if (item.equipSlot === "shield" || item.kind === "shield") {
    const replacingShield = equipment.shield
    const freeHands = getFreeHands(character) + (replacingShield ? 1 : 0)
    if (freeHands < 1) return character

    return character
      .with(
        "inventory",
        replacingShield
          ? [...inventoryWithoutItem, replacingShield]
          : inventoryWithoutItem,
      )
      .with("equipment", {
        ...equipment,
        shield: withShieldDefaults({
          ...itemToEquip,
          heldHands: 1,
        }),
      })
  }

  if (item.equipSlot === "ring") {
    if (equipment.rings.length >= character.getTotalFingers()) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  if (item.equipSlot === "necklace") {
    if ((equipment.necklaces ?? []).length >= 3) return character

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        necklaces: [
          ...(equipment.necklaces ?? []),
          itemToEquip as Equipment,
        ],
      })
  }

  const slot = item.equipSlot as Exclude<
    keyof typeof equipment,
    "weapons" | "rings" | "necklaces" | "pockets" | "heldItems"
  >
  const previous = equipment[slot]

  return character
    .with(
      "inventory",
      previous
        ? [...inventoryWithoutItem, previous as Itemmable]
        : inventoryWithoutItem,
    )
    .with("equipment", {
      ...equipment,
      [slot]: itemToEquip,
    })
}

export function pocketInventoryItemWithRules(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const inventory = character.get("inventory")
  const itemIndex = inventory.findIndex((entry) => entry.id === itemId)
  const item = inventory[itemIndex]

  if (!item || !canItemGoInPocket(item)) return character

  const equipment = character.get("equipment")
  const freePocketCount = Math.max(0, 8 - equipment.pockets.length)
  if (freePocketCount <= 0) return character

  const availableQuantity = Math.max(1, Math.trunc(item.quantity ?? 1))
  const movedQuantity = Math.min(availableQuantity, freePocketCount)
  const pocketUnits = Array.from({ length: movedQuantity }, () => ({
    ...item,
    id: crypto.randomUUID(),
    quantity: 1,
    pocketable: true,
    insideBagOfHolding: false,
  }))
  const remainingQuantity = availableQuantity - movedQuantity
  const nextInventory = [
    ...inventory.slice(0, itemIndex),
    ...(remainingQuantity > 0
      ? [{ ...item, quantity: remainingQuantity }]
      : []),
    ...inventory.slice(itemIndex + 1),
  ]

  return character
    .with("inventory", nextInventory)
    .with("equipment", {
      ...equipment,
      pockets: [...equipment.pockets, ...pocketUnits],
    })
}

export function wieldPocketWeaponWithRules(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const item = equipment.pockets[index]

  if (!item || item.kind !== "equipment" || item.equipSlot !== "weapon") {
    return character
  }

  const weapon = toWeapon(item)
  if (getFreeHands(character) < getWeaponRequiredHands(weapon)) return character

  return character.with("equipment", {
    ...equipment,
    pockets: equipment.pockets.filter(
      (_, currentIndex) => currentIndex !== index,
    ),
    weapons: [...equipment.weapons, { ...weapon, quantity: 1 }],
  })
}

function equipItemInHand(
  character: CharacterTemplate,
  item: Itemmable,
  hands: 1 | 2 = 1,
): CharacterTemplate {
  if (getFreeHands(character) < hands) return character

  const equipment = character.get("equipment")
  const inventory = character.get("inventory")
  const itemIndex = inventory.findIndex((entry) => entry.id === item.id)
  if (itemIndex < 0) return character

  const availableQuantity = Math.max(1, Math.trunc(item.quantity ?? 1))
  const inventoryBefore = inventory.slice(0, itemIndex)
  const inventoryAfter = inventory.slice(itemIndex + 1)

  if (item.kind === "equipment" && item.equipSlot === "weapon") {
    const weapon = toWeapon({ ...item, quantity: 1 })
    const nextWeapon: Weapon = {
      ...weapon,
      quantity: 1,
      heldHands: undefined,
      wieldedTwoHanded: hands === 2,
    }
    const remainingQuantity = availableQuantity - 1
    const freePocketCount = Math.max(0, 8 - equipment.pockets.length)
    const pocketedQuantity = Math.min(remainingQuantity, freePocketCount)
    const pocketUnits = Array.from({ length: pocketedQuantity }, () => ({
      ...item,
      id: crypto.randomUUID(),
      quantity: 1,
      pocketable: true,
      insideBagOfHolding: false,
    }))
    const leftoverQuantity = remainingQuantity - pocketedQuantity
    const nextInventory = [
      ...inventoryBefore,
      ...(leftoverQuantity > 0
        ? [{ ...item, quantity: leftoverQuantity }]
        : []),
      ...inventoryAfter,
    ]

    return character
      .with("inventory", nextInventory)
      .with("equipment", {
        ...equipment,
        pockets: [...equipment.pockets, ...pocketUnits],
        weapons: [...equipment.weapons, nextWeapon],
      })
  }

  const remainingQuantity = availableQuantity - 1
  const nextInventory = [
    ...inventoryBefore,
    ...(remainingQuantity > 0
      ? [{ ...item, quantity: remainingQuantity }]
      : []),
    ...inventoryAfter,
  ]

  return character
    .with("inventory", nextInventory)
    .with("equipment", {
      ...equipment,
      heldItems: [
        ...(equipment.heldItems ?? []),
        {
          ...item,
          id: crypto.randomUUID(),
          quantity: 1,
          heldHands: hands,
          insideBagOfHolding: false,
        },
      ],
    })
}

function getWeaponRequiredHands(weapon: Weapon): number {
  return getWeaponHandsUsed(weapon)
}

function toWeapon(item: Itemmable): Weapon {
  const weapon = item as Partial<Weapon>
  const properties = [...(weapon.properties ?? [])]
  const versatile = isVersatileWeapon(weapon)

  if (versatile && !properties.some((property) => property.id === "versatile")) {
    properties.push(WEAPON_PROPERTIES.versatile)
  }

  const damage = weapon.damage ?? {
    quantity: 1,
    sides: "d6",
  }

  return {
    ...item,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties,
    twoHanded: undefined,
    wieldedTwoHanded: weapon.wieldedTwoHanded ?? false,
    damage,
    versatileDamage: versatile
      ? (weapon.versatileDamage ?? { ...damage })
      : undefined,
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  } as Weapon
}
