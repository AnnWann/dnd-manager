// models/characters/characterEquipment.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import type { Armor } from "../items/equipment/Armor"

type SingleSlot = Exclude<
  keyof CharacterEquipment,
  "weapons" | "rings" | "pockets"
>

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

export function getWeight(character: CharacterTemplate): number {
  const equipment = character.get("equipment")

  const ringsWeight = equipment.rings.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const weaponsWeight = equipment.weapons.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const pocketsWeight = equipment.pockets.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const equipmentWeight =
    (equipment.armor?.weight ?? 0) * (equipment.armor?.quantity ?? 1) +
    (equipment.boots?.weight ?? 0) * (equipment.boots?.quantity ?? 1) +
    (equipment.gloves?.weight ?? 0) * (equipment.gloves?.quantity ?? 1) +
    (equipment.helmet?.weight ?? 0) * (equipment.helmet?.quantity ?? 1) +
    ringsWeight +
    weaponsWeight +
    pocketsWeight

  const inventoryWeight = character
    .get("inventory")
    .reduce((total, item) => {
      if (item.insideBagOfHolding) {
        return total
      }

      return (
        total +
        (item.weight ?? 0) * (item.quantity ?? 1)
      )
    }, 0)

  return inventoryWeight + equipmentWeight
}

export function getCarryingCapacity(character: CharacterTemplate): number {
  return character.getEffectiveAttribute("str") * 15
}

export function getEncumbranceLimit(character: CharacterTemplate): number {
  return character.getEffectiveAttribute("str") * 5
}

export function getHeavyEncumbranceLimit(character: CharacterTemplate): number {
  return character.getEffectiveAttribute("str") * 10
}

export function wear<K extends SingleSlot>(
  character: CharacterTemplate,
  slot: K,
  item: CharacterEquipment[K],
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    [slot]: item,
  })
}

export function unequip(
  character: CharacterTemplate,
  slot: SingleSlot,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const item = equipment[slot]

  if (!item) return character

  return character.with("equipment", {
    ...equipment,
    [slot]: undefined,
  }).with("inventory", [
    ...character.get("inventory"),
    item,
  ])
}

export function unequipArmor(character: CharacterTemplate): CharacterTemplate {
  return unequip(character, "armor")
}

export function getUsedArms(character: CharacterTemplate): number {
  return (
    character.get("equipment").weapons?.reduce(
      (total, weapon) => total + (weapon.twoHanded ? 2 : 1),
      0,
    ) ?? 0
  )
}

export function useWeapon(
  character: CharacterTemplate,
  weapon: Weapon,
): CharacterTemplate {
  const usedArms = getUsedArms(character)
  const neededArms = weapon.twoHanded ? 2 : 1

  if (usedArms + neededArms > character.get("sheet").arms) {
    throw new Error("All hands are occupied")
  }

  return character.with("equipment", {
    ...character.get("equipment"),
    weapons: [
      ...character.get("equipment").weapons,
      weapon,
    ],
  })
}

export function updateWeapon(
  character: CharacterTemplate,
  index: number,
  weapon: Weapon,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    weapons: character.get("equipment").weapons.map((current, i) =>
      i === index ? weapon : current,
    ),
  })
}

export function removeWeapon(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    weapons: character.get("equipment").weapons.filter((_, i) => i !== index),
  })
}

export function unequipWeapon(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const weapon = character.get("equipment").weapons[index]

  if (!weapon) return character

  return character.with("equipment", {
    ...character.get("equipment"),
    weapons: character.get("equipment").weapons.filter((_, i) => i !== index),
  }).with("inventory", [
    ...character.get("inventory"),
    weapon,
  ])
}

export function getUsedFingers(character: CharacterTemplate): number {
  return character.get("equipment").rings.length
}

export function getTotalFingers(character: CharacterTemplate): number {
  return character.get("sheet").arms * 4
}

export function useRing(
  character: CharacterTemplate,
  ring: Equipment,
): CharacterTemplate {
  if (getUsedFingers(character) >= getTotalFingers(character)) {
    throw new Error("All fingers are occupied")
  }

  return character.with("equipment", {
    ...character.get("equipment"),
    rings: [
      ...character.get("equipment").rings,
      ring,
    ],
  })
}

export function updateRing(
  character: CharacterTemplate,
  index: number,
  ring: Equipment,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    rings: character.get("equipment").rings.map((current, i) =>
      i === index ? ring : current,
    ),
  })
}

export function removeRing(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    rings: character.get("equipment").rings.filter((_, i) => i !== index),
  })
}

export function unequipRing(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const ring = character.get("equipment").rings[index]

  if (!ring) return character

  return character.with("equipment", {
    ...character.get("equipment"),
    rings: character.get("equipment").rings.filter((_, i) => i !== index),
  }).with("inventory", [
    ...character.get("inventory"),
    ring,
  ])
}

export function addToPocketItem(
  character: CharacterTemplate,
  item: Itemmable,
): CharacterTemplate {
  if (!item.pocketable) {
    throw new Error("Item is not pocketable")
  }

  if (character.get("equipment").pockets.length >= 8) {
    throw new Error("All pockets are occupied")
  }

  return character.with("equipment", {
    ...character.get("equipment"),
    pockets: [
      ...character.get("equipment").pockets,
      item,
    ],
  })
}

export function pocketInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const item = character.get("inventory").find((i) => i.id === itemId)

  if (!item || !item.pocketable) return character

  return character.with("inventory", character.get("inventory").filter((i) => i.id !== itemId))
    .with("equipment", {
      ...character.get("equipment"),
      pockets: [
        ...character.get("equipment").pockets,
        item,
      ],
    })
}

export function updatePocketItem(
  character: CharacterTemplate,
  index: number,
  item: Itemmable,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    pockets: character.get("equipment").pockets.map((current, i) =>
      i === index ? item : current,
    ),
  })
}

export function removePocketItem(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  return character.with("equipment", {
    ...character.get("equipment"),
    pockets: character.get("equipment").pockets.filter((_, i) => i !== index),
  })
}

export function unequipPocketItem(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const item = character.get("equipment").pockets[index]

  if (!item) return character

  return character.with("equipment", {
    ...character.get("equipment"),
    pockets: character.get("equipment").pockets.filter((_, i) => i !== index),
  }).with("inventory", [
    ...character.get("inventory"),
    item,
  ])
}

export function wieldPocketWeapon(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const item = character.get("equipment").pockets[index]

  if (!item || item.kind !== "equipment" || item.equipSlot !== "weapon") {
    return character
  }

  const weapon = toWeapon(item)
  const pocketsWithoutItem = character.get("equipment").pockets.filter(
    (_, i) => i !== index,
  )

  const neededArms = weapon.twoHanded ? 2 : 1
  const currentWeapons = [...character.get("equipment").weapons]
  const returnedToInventory: Itemmable[] = []

  let usedArms = currentWeapons.reduce(
    (total, currentWeapon) => total + (currentWeapon.twoHanded ? 2 : 1),
    0,
  )

  while (
    usedArms + neededArms > character.get("sheet").arms &&
    currentWeapons.length > 0
  ) {
    const removed = currentWeapons.shift()
    if (!removed) break

    returnedToInventory.push(removed)
    usedArms -= removed.twoHanded ? 2 : 1
  }

  return character.with("inventory", [
    ...character.get("inventory"),
    ...returnedToInventory,
  ]).with("equipment", {
    ...character.get("equipment"),
    pockets: pocketsWithoutItem,
    weapons: [...currentWeapons, weapon],
  })
}

export function usePocketItem(
  character: CharacterTemplate,
  index: number,
): CharacterTemplate {
  const item = character.get("equipment").pockets[index]

  if (!item) return character

  if (item.kind !== "consumable" && item.kind !== "throwable") {
    return character
  }

  const nextQuantity = Math.max(0, (item.quantity ?? 1) - 1)
  const nextItem = {
    ...item,
    quantity: nextQuantity,
  }

  const pocketsWithoutItem = character.get("equipment").pockets.filter(
    (_, i) => i !== index,
  )

  if (nextQuantity <= 0) {
    return character.with("inventory", [
      ...character.get("inventory"),
      nextItem,
    ]).with("equipment", {
      ...character.get("equipment"),
      pockets: pocketsWithoutItem,
    })
  }

  return character.with("equipment", {
    ...character.get("equipment"),
    pockets: character.get("equipment").pockets.map((pocketItem, i) =>
      i === index ? nextItem : pocketItem,
    ),
  })
}

export function equipInventoryItem(
  character: CharacterTemplate,
  itemId: string,
): CharacterTemplate {
  const item = character
    .get("inventory")
    .find((entry) => entry.id === itemId)

  if (!item || item.kind !== "equipment") return character

  const itemToEquip = {
    ...item,
    insideBagOfHolding: false,
  }

  let nextCharacter = character

  if (itemToEquip.equipSlot === "weapon") {
    nextCharacter = nextCharacter.useWeapon(toWeapon(itemToEquip))
  } else if (itemToEquip.equipSlot === "ring") {
    nextCharacter = nextCharacter.useRing(itemToEquip)
  } else if (itemToEquip.equipSlot) {
    nextCharacter = nextCharacter.wear(itemToEquip.equipSlot, itemToEquip)
  }

  return nextCharacter.removeInventoryItem(itemId)
}