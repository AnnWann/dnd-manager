// models/characters/characterStats.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import type { Bonus, Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Attribute } from "../sheet/Attribute"
import type { Sheet } from "../sheet/Sheet"

export type StatBonusKey =
  | "armorClass"
  | "initiative"
  | "passivePerception"
  | "speed"

export function getProficiencyBonus(character: CharacterTemplate): number {
  const totalLevel =
    character.get("sheet").classes?.reduce(
      (total, classData) => total + classData.level,
      0,
    ) ?? 1

  return Math.ceil(totalLevel / 4) + 1
}

export function getAttributeModifier(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  return Math.floor(
    (character.get("sheet").attributes[attribute] - 10) / 2,
  )
}

export function getEquippedItems(character: CharacterTemplate): Equipment[] {
  const equipment = character.get("equipment")

  return [
    equipment.armor,
    equipment.boots,
    equipment.helmet,
    equipment.gloves,
    ...equipment.rings,
    ...equipment.weapons,
  ].filter((item): item is Equipment => item !== undefined)
}

export function getEquipmentBonuses(
  character: CharacterTemplate,
  key: StatBonusKey,
): Bonus[] {
  return getEquippedItems(character).flatMap(
    (item) => item.bonuses?.[key] ?? [],
  )
}

export function getEffectiveAttribute(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const baseValue = character.get("sheet").attributes[attribute]

  const bonuses = getEquippedItems(character)
    .flatMap((item) => item.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  return applyBonuses(baseValue, bonuses)
}

export function getEffectiveAttributeModifier(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const baseModifier = Math.floor(
    (getEffectiveAttribute(character, attribute) - 10) / 2,
  )

  const bonuses = getEquippedItems(character)
    .flatMap((item) => item.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  return applyBonuses(baseModifier, bonuses)
}

export function getEffectiveStat<K extends keyof Sheet["stats"]>(
  character: CharacterTemplate,
  stat: K,
): Sheet["stats"][K] {
  const baseValue = character.get("sheet").stats[stat]

  if (typeof baseValue !== "number") return baseValue

  const bonusKey = statToBonusKey(stat)

  if (!bonusKey) return baseValue

  return applyBonuses(
    baseValue,
    getEquipmentBonuses(character, bonusKey),
  ) as Sheet["stats"][K]
}

export function getEffectiveArmorClass(character: CharacterTemplate): number {
  return getEffectiveStat(character, "armorClass") as number
}

export function getEffectiveInitiative(character: CharacterTemplate): number {
  return getEffectiveStat(character, "initiative") as number
}

export function getEffectivePassivePerception(
  character: CharacterTemplate,
): number {
  return getEffectiveStat(character, "passive_perception") as number
}

export function getEffectiveMobility(character: CharacterTemplate): number {
  return getEffectiveStat(character, "mobility") as number
}

export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponBonus = weapon.bonuses?.attack?.bonus

  return applyBonuses(
    baseValue,
    weaponBonus ? [weaponBonus] : [],
  )
}

export function getEffectiveWeaponDamageBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponBonus = weapon.bonuses?.damage?.bonus

  return applyBonuses(
    baseValue,
    weaponBonus ? [weaponBonus] : [],
  )
}

export function applyBonus(baseValue: number, bonus: Bonus): number {
  if (bonus.type === "add") return baseValue + bonus.value
  if (bonus.type === "sub") return baseValue - bonus.value
  return bonus.value
}

export function applyBonuses(
  baseValue: number,
  bonuses: Bonus[],
): number {
  const flatBonus = bonuses.find((bonus) => bonus.type === "flat")

  if (flatBonus) return flatBonus.value

  return bonuses.reduce(
    (total, bonus) => applyBonus(total, bonus),
    baseValue,
  )
}

function statToBonusKey(
  stat: keyof Sheet["stats"],
): StatBonusKey | undefined {
  if (stat === "armorClass") return "armorClass"
  if (stat === "initiative") return "initiative"
  if (stat === "passive_perception") return "passivePerception"
  if (stat === "mobility") return "speed"

  return undefined
}