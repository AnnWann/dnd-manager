import type { Ability } from "../abilities/Ability"
import type { Bonus, NormalBonusKey } from "../bonuses/Bonus"
import type { Armor } from "../items/equipment/Armor"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Attribute } from "../sheet/Attribute"
import type { Sheet } from "../sheet/Sheet"
import type { CharacterTemplate } from "./CharacterTemplate"
import { getEncumbranceSpeedPenalty } from "./characterEncumbrance"

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
    equipment.cape,
    ...equipment.rings,
    ...equipment.weapons,
    ...equipment.pockets.filter(
      (item): item is Equipment => item.kind === "equipment",
    ),
  ].filter((item): item is Equipment => item !== undefined)
}

export function getActiveAbilities(
  character: CharacterTemplate,
): Ability[] {
  return [
    ...(character.get("abilities") ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap(
      (item) => item.abilities ?? [],
    ),
  ]
}

export function getEquipmentBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getEquippedItems(character).flatMap(
    (item) => item.bonuses?.[key] ?? [],
  )
}

export function getAbilityBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getActiveAbilities(character).flatMap(
    (ability) => ability.bonuses?.[key] ?? [],
  )
}

export function getCharacterBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return [
    ...getEquipmentBonuses(character, key),
    ...getAbilityBonuses(character, key),
  ]
}

export function getEffectiveAttribute(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const racialBonus =
    character.get("sheet").race.attributeBonus?.[attribute] ?? 0

  const baseValue =
    character.get("sheet").attributes[attribute] + racialBonus

  const equipmentBonuses = getEquippedItems(character)
    .flatMap((item) => item.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  return applyBonuses(baseValue, [
    ...equipmentBonuses,
    ...abilityBonuses,
  ])
}

export function getEffectiveAttributeModifier(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const baseModifier = Math.floor(
    (getEffectiveAttribute(character, attribute) - 10) / 2,
  )

  const equipmentBonuses = getEquippedItems(character)
    .flatMap((item) => item.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => entry.bonus)

  return applyBonuses(baseModifier, [
    ...equipmentBonuses,
    ...abilityBonuses,
  ])
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
    getCharacterBonuses(character, bonusKey),
  ) as Sheet["stats"][K]
}

export function getEffectiveArmorClass(character: CharacterTemplate): number {
  const armor = getEquippedArmor(character)
  const allBonuses = getCharacterBonuses(character, "armorClass")
  const flatBase =
    armor?.bonuses?.armorClass?.find(
      (bonus) => bonus.type === "flat",
    )?.value ??
    allBonuses.find((bonus) => bonus.type === "flat")?.value

  const baseArmorClass =
    flatBase ?? character.get("sheet").stats.armorClass ?? 10

  return applyBonuses(
    baseArmorClass + getArmorDexBonus(character),
    allBonuses.filter((bonus) => bonus.type !== "flat"),
  )
}

export function getEffectiveInitiative(character: CharacterTemplate): number {
  const dexModifier = getEffectiveAttributeModifier(character, "dex")

  return applyBonuses(
    dexModifier,
    getCharacterBonuses(character, "initiative"),
  )
}

export function getEffectivePassivePerception(
  character: CharacterTemplate,
): number {
  let wisdomModifier = getEffectiveAttributeModifier(character, "wis")
  const perceptionProficiency = character.get("sheet").skills.perception

  if (perceptionProficiency === "proficient")
    wisdomModifier += getProficiencyBonus(character)

  if (perceptionProficiency === "expertise")
    wisdomModifier += getProficiencyBonus(character) * 2

  return applyBonuses(
    10 + wisdomModifier,
    getCharacterBonuses(character, "passivePerception"),
  )
}

export function getEffectiveMobility(character: CharacterTemplate): number {
  const raceSpeedBonus =
    character.get("sheet").race.speedBonus ?? 0

  const baseSpeed =
    (character.get("sheet").stats.mobility ?? 9) + raceSpeedBonus

  const unencumberedSpeed = applyBonuses(
    baseSpeed,
    getCharacterBonuses(character, "speed"),
  )

  return Math.max(
    0,
    unencumberedSpeed - getEncumbranceSpeedPenalty(character),
  )
}

export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
  const weaponGeneralBonuses = weapon.bonuses?.attackBonus ?? []
  const abilityBonuses = getAbilityBonuses(character, "attackBonus")

  return applyBonuses(baseValue, [
    ...weaponGeneralBonuses,
    ...abilityBonuses,
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}

export function getEffectiveWeaponDamageBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const weaponDamageBonus = weapon.bonuses?.damage?.bonus
  const weaponGeneralBonuses = weapon.bonuses?.damageBonus ?? []
  const abilityBonuses = getAbilityBonuses(character, "damageBonus")

  return applyBonuses(baseValue, [
    ...weaponGeneralBonuses,
    ...abilityBonuses,
    ...(weaponDamageBonus ? [weaponDamageBonus] : []),
  ])
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

export function isSavingThrowProficient(
  character: CharacterTemplate,
  attribute: Attribute,
): boolean {
  return (
    character
      .get("sheet")
      .savingThrowProficiencies?.[attribute] ?? false
  )
}

export function getSavingThrowBonus(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const attributeModifier =
    getEffectiveAttributeModifier(character, attribute)

  if (!isSavingThrowProficient(character, attribute)) {
    return attributeModifier
  }

  return attributeModifier + getProficiencyBonus(character)
}

export function setSavingThrowProficiency(
  character: CharacterTemplate,
  attribute: Attribute,
  proficient: boolean,
): CharacterTemplate {
  const current =
    character.get("sheet").savingThrowProficiencies ?? {}

  return character.withSheet("savingThrowProficiencies", {
    ...current,
    [attribute]: proficient,
  })
}
