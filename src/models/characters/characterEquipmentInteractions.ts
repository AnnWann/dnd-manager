import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"
import type { Weapon } from "../items/equipment/Weapon"
import { canItemGoInPocket } from "../items/itemPocketability"
import { withShieldDefaults } from "../items/equipment/Shield"

export function getUsedArmsIncludingShield(
  character: CharacterTemplate,
): number {
  const equipment = character.get("equipment")
  const weaponArms = equipment.weapons.reduce(
    (total, weapon) => total + (weapon.twoHanded ? 2 : 1),
    0,
  )

  return weaponArms + (equipment.shield ? 1 : 0)
}

export function equipInventoryItemWithRules(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const item = character
    .get("inventory")
    .find((entry) => entry.id === itemId)

  if (!item || !item.equippable || !item.equipSlot) return character

  if (item.kind === "shield" || item.equipSlot === "shield") {
    return equipShield(character, item)
  }

  if (item.equipSlot === "weapon") {
    return equipWeaponRespectingShield(character, item)
  }

  return character.equipInventoryItem(itemId)
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

  const itemToPocket = {
    ...item,
    pocketable: true,
    insideBagOfHolding: false,
  }

  return character
    .with("inventory", [
      ...inventory.slice(0, itemIndex),
      ...inventory.slice(itemIndex + 1),
    ])
    .with("equipment", {
      ...character.get("equipment"),
      pockets: [
        ...character.get("equipment").pockets,
        itemToPocket,
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
  const neededArms = weapon.twoHanded ? 2 : 1
  const maxArms = character.get("sheet").arms
  const currentWeapons = [...equipment.weapons]
  const returnedToInventory: Itemmable[] = []
  let nextShield = equipment.shield
  let usedArms = currentWeapons.reduce(
    (total, currentWeapon) => total + (currentWeapon.twoHanded ? 2 : 1),
    0,
  ) + (nextShield ? 1 : 0)

  while (usedArms + neededArms > maxArms && currentWeapons.length > 0) {
    const removed = currentWeapons.shift()
    if (!removed) break

    returnedToInventory.push(removed)
    usedArms -= removed.twoHanded ? 2 : 1
  }

  if (usedArms + neededArms > maxArms && nextShield) {
    returnedToInventory.push(nextShield)
    nextShield = undefined
    usedArms -= 1
  }

  if (usedArms + neededArms > maxArms) return character

  return character
    .with("inventory", [
      ...character.get("inventory"),
      ...returnedToInventory,
    ])
    .with("equipment", {
      ...equipment,
      shield: nextShield,
      pockets: equipment.pockets.filter((_, currentIndex) => currentIndex !== index),
      weapons: [...currentWeapons, weapon],
    })
}

function equipShield(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const inventory = character.get("inventory")
  const maxArms = character.get("sheet").arms

  if (maxArms < 1) return character

  const currentWeapons = [...equipment.weapons]
  const returnedToInventory: Itemmable[] = []
  let usedWeaponArms = currentWeapons.reduce(
    (total, weapon) => total + (weapon.twoHanded ? 2 : 1),
    0,
  )

  while (usedWeaponArms + 1 > maxArms && currentWeapons.length > 0) {
    const removed = currentWeapons.shift()
    if (!removed) break

    returnedToInventory.push(removed)
    usedWeaponArms -= removed.twoHanded ? 2 : 1
  }

  if (usedWeaponArms + 1 > maxArms) return character

  if (equipment.shield) returnedToInventory.push(equipment.shield)

  return character
    .with("inventory", [
      ...inventory.filter((entry) => entry.id !== item.id),
      ...returnedToInventory,
    ])
    .with("equipment", {
      ...equipment,
      shield: withShieldDefaults(item),
      weapons: currentWeapons,
    })
}

function equipWeaponRespectingShield(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const inventory = character.get("inventory")
  const weapon = toWeapon(item)
  const neededArms = weapon.twoHanded ? 2 : 1
  const maxArms = character.get("sheet").arms
  const currentWeapons = [...equipment.weapons]
  const returnedToInventory: Itemmable[] = []
  let nextShield = equipment.shield
  let usedArms = currentWeapons.reduce(
    (total, currentWeapon) => total + (currentWeapon.twoHanded ? 2 : 1),
    0,
  ) + (nextShield ? 1 : 0)

  while (usedArms + neededArms > maxArms && currentWeapons.length > 0) {
    const removed = currentWeapons.shift()
    if (!removed) break

    returnedToInventory.push(removed)
    usedArms -= removed.twoHanded ? 2 : 1
  }

  if (usedArms + neededArms > maxArms && nextShield) {
    returnedToInventory.push(nextShield)
    nextShield = undefined
    usedArms -= 1
  }

  if (usedArms + neededArms > maxArms) return character

  return character
    .with("inventory", [
      ...inventory.filter((entry) => entry.id !== item.id),
      ...returnedToInventory,
    ])
    .with("equipment", {
      ...equipment,
      shield: nextShield,
      weapons: [...currentWeapons, weapon],
    })
}

function toWeapon(item: Itemmable): Weapon {
  const weapon = item as Partial<Weapon>

  return {
    ...item,
    kind: "equipment",
    equippable: true,
    equipSlot: "weapon",
    properties: weapon.properties ?? [],
    twoHanded: weapon.twoHanded ?? false,
    damage: weapon.damage ?? {
      quantity: 1,
      sides: "d6",
    },
    modifierAttribute: weapon.modifierAttribute ?? "str",
    proficient: weapon.proficient ?? false,
  } as Weapon
}
