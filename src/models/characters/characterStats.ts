// models/characters/characterStats.ts

import type { CharacterTemplate } from "./CharacterTemplate"
import type { Bonus, Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Attribute } from "../sheet/Attribute"
import type { Sheet } from "../sheet/Sheet"
import type { Armor } from "../items/equipment/Armor"

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
  const armor = getEquippedArmor(character)

  const baseArmorClass =
    armor?.bonuses?.armorClass?.find((bonus) => bonus.type === "flat")?.value ??
    character.get("sheet").stats.armorClass ??
    10

  const nonFlatArmorBonuses =
    getEquipmentBonuses(character, "armorClass").filter(
      (bonus) => bonus.type !== "flat",
    )

  return applyBonuses(
    baseArmorClass + getArmorDexBonus(character),
    nonFlatArmorBonuses,
  )
}

export function getEffectiveInitiative(character: CharacterTemplate): number {
  const dexModifier = getEffectiveAttributeModifier(character, "dex")

  return applyBonuses(
    dexModifier,
    getEquipmentBonuses(character, "initiative"),
  )
}

export function getEffectivePassivePerception(
  character: CharacterTemplate,
): number {
  let wisdomModifier = getEffectiveAttributeModifier(character, "wis")
  const perceptionProficiency = character.get('sheet').skills.perception

  if (perceptionProficiency === 'proficient')
    wisdomModifier += getProficiencyBonus(character)

  if (perceptionProficiency === 'expertise')
    wisdomModifier += getProficiencyBonus(character) * 2

  return applyBonuses(
    10 + wisdomModifier,
    getEquipmentBonuses(character, "passivePerception"),
  )
}

export function getEffectiveMobility(character: CharacterTemplate): number {
  const baseSpeed = character.get("sheet").stats.mobility ?? 9

  return applyBonuses(
    baseSpeed,
    getEquipmentBonuses(character, "speed"),
  )
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

function getEquippedArmor(character: CharacterTemplate): Armor | undefined {
  return character.get("equipment").armor as Armor | undefined
}

function getArmorDexBonus(character: CharacterTemplate): number {
  const armor = getEquippedArmor(character)
  const dex = getEffectiveAttributeModifier(character, "dex")

  if (!armor) return dex

  if (armor.armorType === "light") return dex
  if (armor.armorType === "medium") return Math.min(dex, 2)
  if (armor.armorType === "heavy") return 0

  return dex
}