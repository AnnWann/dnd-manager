import type { CharacterTemplate } from "./CharacterTemplate"
import { getFreeHands, getUsedHands } from "./characterHands"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import { withShieldDefaults } from "../items/equipment/Shield"
import {
  WEAPON_PROPERTIES,
  hasWeaponProperty,
  isVersatileWeapon,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import { canItemGoInPocket } from "../items/itemPocketability"

export type EquipmentDestination =
  | { type: "natural" }
  | { type: "hand"; wieldedTwoHanded?: boolean }

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

  if (destination.type === "hand") {
    return equipItemInHand(character, item, destination.wieldedTwoHanded)
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
        shield: withShieldDefaults(itemToEquip),
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

  const slot = item.equipSlot as Exclude<
    keyof typeof equipment,
    "weapons" | "rings" | "pockets" | "heldItems"
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
  if (character.get("equipment").pockets.length >= 8) return character

  return character
    .with("inventory", [
      ...inventory.slice(0, itemIndex),
      ...inventory.slice(itemIndex + 1),
    ])
    .with("equipment", {
      ...character.get("equipment"),
      pockets: [
        ...character.get("equipment").pockets,
        {
          ...item,
          pocketable: true,
          insideBagOfHolding: false,
        },
      ],
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
    weapons: [...equipment.weapons, weapon],
  })
}

function equipItemInHand(
  character: CharacterTemplate,
  item: Itemmable,
  wieldedTwoHanded?: boolean,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const inventoryWithoutItem = character
    .get("inventory")
    .filter((entry) => entry.id !== item.id)

  if (item.kind === "equipment" && item.equipSlot === "weapon") {
    const weapon = toWeapon(item)
    const supportsTwoHands = weapon.twoHanded || isVersatileWeapon(weapon)
    const nextWeapon: Weapon = {
      ...weapon,
      wieldedTwoHanded: supportsTwoHands
        ? (wieldedTwoHanded ?? (weapon.twoHanded ? true : false))
        : false,
    }

    if (getFreeHands(character) < getWeaponRequiredHands(nextWeapon)) {
      return character
    }

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        weapons: [...equipment.weapons, nextWeapon],
      })
  }

  if (getFreeHands(character) < 1) return character

  return character
    .with("inventory", inventoryWithoutItem)
    .with("equipment", {
      ...equipment,
      heldItems: [
        ...(equipment.heldItems ?? []),
        {
          ...item,
          insideBagOfHolding: false,
        },
      ],
    })
}

function getWeaponRequiredHands(weapon: Weapon): number {
  if (weapon.twoHanded) return weapon.wieldedTwoHanded === false ? 1 : 2
  if (isVersatileWeapon(weapon) && weapon.wieldedTwoHanded) return 2
  return 1
}

function toWeapon(item: Itemmable): Weapon {
  const weapon = item as Partial<Weapon>
  const properties = [...(weapon.properties ?? [])]
  const versatile =
    hasWeaponProperty(weapon, "versatile") || Boolean(weapon.versatileDamage)

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
    properties: properties.filter((property) =>
      versatile ? property.id !== "two-handed" : property.id !== "versatile",
    ),
    twoHanded: versatile ? false : (weapon.twoHanded ?? false),
    wieldedTwoHanded: versatile
      ? (weapon.wieldedTwoHanded ?? false)
      : (weapon.wieldedTwoHanded ?? weapon.twoHanded ?? false),
    damage,
    versatileDamage: versatile
      ? (weapon.versatileDamage ?? { ...damage })
      : undefined,
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  } as Weapon
}
