// models/characters/characterEquipment.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import { getUsedHands } from "./characterHands"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Bonus, Equipment } from "../items/equipment/EquipmentSlot"
import {
  WEAPON_PROPERTIES,
  getWeaponHandsUsed,
  hasWeaponProperty,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import type { Armor } from "../items/equipment/Armor"
import type { Ability, Usage } from "../abilities/Ability"

type SingleSlot = Exclude<
  keyof CharacterEquipment,
  "weapons" | "rings" | "necklaces" | "pockets" | "heldItems"
>

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

export function getWeight(character: CharacterTemplate): number {
  const equipment = character.get("equipment")

  const ringsWeight = equipment.rings.reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const necklacesWeight = (equipment.necklaces ?? []).reduce(
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

  const heldItemsWeight = (equipment.heldItems ?? []).reduce(
    (total, item) => total + (item.weight ?? 0) * (item.quantity ?? 1),
    0,
  )

  const equipmentWeight =
    (equipment.armor?.weight ?? 0) * (equipment.armor?.quantity ?? 1) +
    (equipment.boots?.weight ?? 0) * (equipment.boots?.quantity ?? 1) +
    (equipment.gloves?.weight ?? 0) * (equipment.gloves?.quantity ?? 1) +
    (equipment.helmet?.weight ?? 0) * (equipment.helmet?.quantity ?? 1) +
    ringsWeight +
    necklacesWeight +
    weaponsWeight +
    heldItemsWeight +
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
  return getUsedHands(character)
}

export function useWeapon(
  character: CharacterTemplate,
  weapon: Weapon,
): CharacterTemplate {
  const usedArms = getUsedArms(character)
  const neededArms = getWeaponHandsUsed(weapon)

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
  const item = character
    .get("inventory")
    .find((entry) => entry.id === itemId)

  if (!item || !item.pocketable) return character

  const itemToPocket = {
    ...item,
    insideBagOfHolding: false,
  }

  return character
    .with("equipment", {
      ...character.get("equipment"),
      pockets: [
        ...character.get("equipment").pockets,
        itemToPocket,
      ],
    })
    .removeInventoryItem(itemId)
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

  const neededArms = getWeaponHandsUsed(weapon)
  const currentWeapons = [...character.get("equipment").weapons]
  const returnedToInventory: Itemmable[] = []

  let usedArms = currentWeapons.reduce(
    (total, currentWeapon) => total + (getWeaponHandsUsed(currentWeapon)),
    0,
  )

  while (
    usedArms + neededArms > character.get("sheet").arms &&
    currentWeapons.length > 0
  ) {
    const removed = currentWeapons.shift()
    if (!removed) break

    returnedToInventory.push(removed)
    usedArms -= getWeaponHandsUsed(removed)
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
  const equipment = character.get("equipment")
  const inventory = character.get("inventory")
  const item = inventory.find((entry) => entry.id === itemId)

  if (!item || !item.equippable || !item.equipSlot) return character

  const inventoryWithoutItem = inventory.filter((entry) => entry.id !== itemId)

  const itemToEquip = {
    ...item,
    insideBagOfHolding: false,
  }

  if (itemToEquip.equipSlot === "weapon") {
    const weapon = toWeapon(itemToEquip)
    const neededArms = getWeaponHandsUsed(weapon)
    const currentWeapons = [...equipment.weapons]
    const returnedToInventory: Itemmable[] = []

    let usedArms = currentWeapons.reduce(
      (total, currentWeapon) => total + (getWeaponHandsUsed(currentWeapon)),
      0,
    )

    while (
      usedArms + neededArms > character.get("sheet").arms &&
      currentWeapons.length > 0
    ) {
      const removed = currentWeapons.shift()
      if (!removed) break

      returnedToInventory.push(removed)
      usedArms -= getWeaponHandsUsed(removed)
    }

    if (usedArms + neededArms > character.get("sheet").arms) {
      return character
    }

    return character
      .with("inventory", [...inventoryWithoutItem, ...returnedToInventory])
      .with("equipment", {
        ...equipment,
        weapons: [...currentWeapons, weapon],
      })
  }

  if (itemToEquip.equipSlot === "ring") {
    if (getUsedFingers(character) >= getTotalFingers(character)) {
      return character
    }

    return character
      .with("inventory", inventoryWithoutItem)
      .with("equipment", {
        ...equipment,
        rings: [...equipment.rings, itemToEquip as Equipment],
      })
  }

  if (itemToEquip.equipSlot === "necklace") {
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

  const slot = itemToEquip.equipSlot as SingleSlot
  const previous = equipment[slot]

  return character
    .with("inventory", previous
      ? [...inventoryWithoutItem, previous]
      : inventoryWithoutItem,
    )
    .with("equipment", {
      ...equipment,
      [slot]: itemToEquip,
    })
}

export function getEquippedItems(character: CharacterTemplate): Equipment[] {
  const equipment = character.get("equipment")

  return [
    equipment.armor,
    equipment.boots,
    equipment.gloves,
    equipment.helmet,
    ...(equipment.necklaces ?? []),
    ...equipment.rings,
    ...equipment.weapons,
    ...(equipment.heldItems ?? []).filter((item) => item.kind === "focus"),
    ...equipment.pockets.filter((item) => item.kind === "equipment"),
  ].filter(Boolean) as Equipment[]
}

export type EquipmentGrantedAbility = Ability & {
  source: "equipment"
  sourceItemId: string
  sourceItemName: string
  originalAbilityId: string
}

export function getEquipmentAbilities(
  character: CharacterTemplate,
): EquipmentGrantedAbility[] {
  return getEquippedItems(character).flatMap((item) =>
    item.abilities?.map((ability) => ({
      ...ability,
      id: `${item.id}:${ability.id}`,
      source: "equipment",
      sourceItemId: item.id,
      sourceItemName: item.name,
      originalAbilityId: ability.id,
    })) ?? [],
  )
}

export function getEquipmentSpells(character: CharacterTemplate) {
  return getEquippedItems(character).flatMap((item) =>
    item.spells?.map((spell) => ({
      ...spell,
      sourceItemId: item.id,
      sourceItemName: item.name,
    })) ?? [],
  )
}

export function getEquipmentBonuses<
  K extends keyof NonNullable<Equipment["bonuses"]>,
>(
  character: CharacterTemplate,
  key: K,
): NonNullable<Equipment["bonuses"]>[K][] {
  return getEquippedItems(character)
    .map((item) => item.bonuses?.[key])
    .filter(Boolean) as NonNullable<Equipment["bonuses"]>[K][]
}

export function getFlatEquipmentBonuses(
  character: CharacterTemplate,
  key:
    | "armorClass"
    | "initiative"
    | "maxHp"
    | "temporaryHp"
    | "passivePerception"
    | "attackBonus"
    | "speed",
): Bonus[] {
  return getEquippedItems(character).flatMap(
    (item) => item.bonuses?.[key] ?? [],
  )
}

export function getAttributeBonuses(
  character: CharacterTemplate,
  attribute: string,
): Bonus[] {
  return getEquippedItems(character).flatMap(
    (item) =>
      item.bonuses?.attribute
        ?.filter((entry) => entry.attribute === attribute)
        .map((entry) => entry.bonus) ?? [],
  )
}

export function getAttributeModifierBonuses(
  character: CharacterTemplate,
  attribute: string,
): Bonus[] {
  return getEquippedItems(character).flatMap(
    (item) =>
      item.bonuses?.attributeModifier
        ?.filter((entry) => entry.attribute === attribute)
        .map((entry) => entry.bonus) ?? [],
  )
}

export type ConditionalBonus = {
  type: "always" | "equipment" | "conditional"
  condition?: string
  bonus: Bonus
}

export function getAttackRollBonuses(
  character: CharacterTemplate,
): ConditionalBonus[] {
  return getEquippedItems(character).flatMap((item) => {
    const attack = item.bonuses?.attack
    if (!attack) return []
    return Array.isArray(attack) ? attack : [attack]
  }) as ConditionalBonus[]
}

export function getDamageBonuses(
  character: CharacterTemplate,
): ConditionalBonus[] {
  return getEquippedItems(character).flatMap((item) => {
    const damage = item.bonuses?.damage
    if (!damage) return []
    return Array.isArray(damage) ? damage : [damage]
  }) as ConditionalBonus[]
}

function updateEquipmentById(
  character: CharacterTemplate,
  itemId: string,
  updater: (equipment: Equipment) => Equipment,
): CharacterTemplate {
  const equipment = character.get("equipment")
  const inventory = character.get("inventory")

  const updateItem = <T extends Itemmable | undefined>(item: T): T => {
    if (!item || item.id !== itemId || item.kind !== "equipment") return item
    return updater(item as Equipment) as T
  }

  return character.with("inventory", inventory.map(updateItem)).with("equipment", {
    ...equipment,
    armor: updateItem(equipment.armor),
    boots: updateItem(equipment.boots),
    gloves: updateItem(equipment.gloves),
    helmet: updateItem(equipment.helmet),
    necklaces: (equipment.necklaces ?? []).map(updateItem),
    rings: equipment.rings.map(updateItem),
    weapons: equipment.weapons.map(updateItem),
    heldItems: (equipment.heldItems ?? []).map(updateItem),
    pockets: equipment.pockets.map(updateItem),
  })
}

export function addAbilityToEquipment(
  character: CharacterTemplate,
  itemId: string,
  ability: Ability,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: [...(equipment.abilities ?? []), ability],
  }))
}

export function updateEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  ability: Ability,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((current) =>
      current.id === ability.id ? ability : current,
    ),
  }))
}

export function removeEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).filter(
      (ability) => ability.id !== abilityId,
    ),
  }))
}

export function addSpellToEquipment(
  character: CharacterTemplate,
  itemId: string,
  spell: { index: string; usage: Usage },
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    spells: [...(equipment.spells ?? []), spell],
  }))
}

export function updateEquipmentSpell(
  character: CharacterTemplate,
  itemId: string,
  spell: { index: string; usage: Usage },
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    spells: (equipment.spells ?? []).map((current) =>
      current.index === spell.index ? spell : current,
    ),
  }))
}

export function removeEquipmentSpell(
  character: CharacterTemplate,
  itemId: string,
  spellIndex: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    spells: (equipment.spells ?? []).filter(
      (spell) => spell.index !== spellIndex,
    ),
  }))
}

export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) => {
      if (ability.id !== abilityId || !ability.usage) return ability
      if (ability.usage.reset === "spellSlot") return ability

      return {
        ...ability,
        usage: {
          ...ability.usage,
          used: Math.min(ability.usage.max, ability.usage.used + 1),
        },
      }
    }),
  }))
}

export function restoreEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) => {
      if (ability.id !== abilityId || !ability.usage) return ability
      if (ability.usage.reset === "spellSlot") return ability
      if (ability.usage.reset === "limited") return ability

      return {
        ...ability,
        usage: {
          ...ability.usage,
          used: Math.max(0, ability.usage.used - 1),
        },
      }
    }),
  }))
}