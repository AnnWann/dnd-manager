import type { Ability } from "../abilities/Ability"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"
import type { Bonus, NormalBonusKey, ScopedBonusKey } from "../bonuses/Bonus"
import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { Armor } from "../items/equipment/Armor"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import {
  getWeaponAttackAttribute,
  isWeaponImprovisedGrip,
  type Weapon,
} from "../items/equipment/Weapon"
import type { Attribute } from "../sheet/Attribute"
import type { Sheet } from "../sheet/Sheet"
import type { CharacterTemplate } from "./CharacterTemplate"
import { getEncumbranceSpeedPenalty } from "./characterEncumbrance"
import { getCharacterConditions } from "./characterConditionStorage"
import { hasProficiency } from "./characterProficiencies"
import { attributeShort } from "../../lib/attributeShorts"

export type StatBonusKey =
  | "armorClass"
  | "initiative"
  | "passivePerception"
  | "speed"

export type CalculatedStatKey =
  | "armorClass"
  | "initiative"
  | "mobility"
  | "passive_perception"

export type StatAdjustmentKey =
  | "armorClassAdjustment"
  | "initiativeAdjustment"
  | "mobilityAdjustment"
  | "passivePerceptionAdjustment"

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
    ...(equipment.necklaces ?? []),
    ...equipment.rings,
    ...equipment.weapons,
    ...(equipment.heldItems ?? []).filter(
      (item): item is Equipment => item.kind === "focus",
    ),
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
    ...getCharacterConditions(character).flatMap(
      (condition) => condition.grantedAbilities ?? [],
    ),
  ].filter(isAbilityBenefitsActive)
}

export function getEquipmentBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getEquippedItems(character)
    .flatMap((item) => item.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))
}

export function getAbilityBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  if (key === "temporaryHp") return []

  return getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))
}

export function getConditionBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))
}

export function getCharacterBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return [
    ...getEquipmentBonuses(character, key),
    ...getAbilityBonuses(character, key),
    ...getConditionBonuses(character, key),
  ]
}

export function getScopedCharacterBonuses(
  character: CharacterTemplate,
  key: ScopedBonusKey,
  attribute: Attribute,
): Bonus[] {
  const collect = (
    collection: { bonuses?: Partial<Record<ScopedBonusKey, Array<{ attribute?: Attribute; bonus: Bonus }>>> },
  ) =>
    (collection.bonuses?.[key] ?? [])
      .filter((entry) => !entry.attribute || entry.attribute === attribute)
      .map((entry) => resolveBonus(character, entry.bonus))

  return [
    ...getEquippedItems(character).flatMap(collect),
    ...getActiveAbilities(character).flatMap(collect),
    ...getCharacterConditions(character)
      .filter(isConditionActive)
      .flatMap(collect),
  ]
}

export function getEffectiveAttackBonus(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "attackBonus"),
  )
}

export function getEffectiveSpellAttackBonus(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...getScopedCharacterBonuses(character, "spellAttackBonus", attribute),
  ])
}

export function getEffectiveSpellDamageBonus(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...getScopedCharacterBonuses(character, "spellDamageBonus", attribute),
  ])
}

export function getEffectiveSaveDc(
  character: CharacterTemplate,
  baseValue: number,
): number {
  return applyBonuses(
    baseValue,
    getCharacterBonuses(character, "saveDcBonus"),
  )
}

export function getEffectiveSpellSaveDc(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "saveDcBonus"),
    ...getScopedCharacterBonuses(character, "spellSaveDcBonus", attribute),
  ])
}

export function getEffectiveAbilitySaveDc(
  character: CharacterTemplate,
  attribute: Attribute,
  baseValue: number,
): number {
  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "saveDcBonus"),
    ...getScopedCharacterBonuses(character, "abilitySaveDcBonus", attribute),
  ])
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
    .map((entry) => resolveBonus(character, entry.bonus))

  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  const conditionBonuses = getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseValue, [
    ...equipmentBonuses,
    ...abilityBonuses,
    ...conditionBonuses,
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
    .map((entry) => resolveBonus(character, entry.bonus))

  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  const conditionBonuses = getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseModifier, [
    ...equipmentBonuses,
    ...abilityBonuses,
    ...conditionBonuses,
  ])
}

export function getEffectiveArmorClass(character: CharacterTemplate): number {
  const armorClass = character.get("sheet").stats.armorClass
  const armor = character.get("equipment").armor as Armor | undefined

  if (!armor) {
    return applyBonuses(
      armorClass,
      getCharacterBonuses(character, "armorClass"),
    )
  }

  const dexterityModifier = getEffectiveAttributeModifier(character, "dex")
  const armorBase = armor.armorClass ?? armorClass
  const armorType = armor.armorType ?? "light"
  const dexterityContribution =
    armorType === "heavy"
      ? 0
      : armorType === "medium"
        ? Math.min(2, dexterityModifier)
        : dexterityModifier

  return applyBonuses(
    armorBase + dexterityContribution,
    getCharacterBonuses(character, "armorClass"),
  )
}

export function getEffectiveInitiative(character: CharacterTemplate): number {
  return applyBonuses(
    character.get("sheet").stats.initiative,
    getCharacterBonuses(character, "initiative"),
  )
}

export function getEffectivePassivePerception(character: CharacterTemplate): number {
  return applyBonuses(
    character.get("sheet").stats.passive_perception,
    getCharacterBonuses(character, "passivePerception"),
  )
}

export function getEffectiveMobility(character: CharacterTemplate): number {
  const baseMobility = character.get("sheet").stats.mobility
  return Math.max(
    0,
    applyBonuses(
      baseMobility - getEncumbranceSpeedPenalty(character),
      getCharacterBonuses(character, "speed"),
    ),
  )
}

export function getEffectiveStat<K extends keyof Sheet["stats"]>(
  character: CharacterTemplate,
  key: K,
): Sheet["stats"][K] {
  const value = character.get("sheet").stats[key]

  if (typeof value !== "number") return value

  if (key === "armorClass") {
    return getEffectiveArmorClass(character) as Sheet["stats"][K]
  }
  if (key === "initiative") {
    return getEffectiveInitiative(character) as Sheet["stats"][K]
  }
  if (key === "mobility") {
    return getEffectiveMobility(character) as Sheet["stats"][K]
  }
  if (key === "passive_perception") {
    return getEffectivePassivePerception(character) as Sheet["stats"][K]
  }

  return value
}

export function getSavingThrowBonus(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const base = getEffectiveAttributeModifier(character, attribute)
  const proficiency = isSavingThrowProficient(character, attribute)
    ? getProficiencyBonus(character)
    : 0
  const bonuses = getScopedCharacterBonuses(
    character,
    "savingThrowBonus",
    attribute,
  )

  return applyBonuses(base + proficiency, bonuses)
}

export function isSavingThrowProficient(
  character: CharacterTemplate,
  attribute: Attribute,
): boolean {
  return Boolean(character.get("sheet").savingThrowProficiencies?.[attribute])
}

export function setSavingThrowProficiency(
  character: CharacterTemplate,
  attribute: Attribute,
  proficient: boolean,
): CharacterTemplate {
  return character.withSheet("savingThrowProficiencies", {
    ...(character.get("sheet").savingThrowProficiencies ?? {}),
    [attribute]: proficient,
  })
}

export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const attribute = getWeaponAttackAttribute(weapon)
  const proficiency = isWeaponProficient(character, weapon)
    ? getProficiencyBonus(character)
    : 0
  return getEffectiveAttackBonus(
    character,
    baseValue + getEffectiveAttributeModifier(character, attribute) + proficiency,
  )
}

export function getEffectiveWeaponDamageBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const attribute = getWeaponAttackAttribute(weapon)
  return applyBonuses(
    baseValue + getEffectiveAttributeModifier(character, attribute),
    getCharacterBonuses(character, "damageBonus"),
  )
}

export function applyBonus(baseValue: number, bonus: Bonus): number {
  if (bonus.type === "add") return baseValue + bonus.value
  if (bonus.type === "sub") return baseValue - bonus.value
  return bonus.value
}

export function applyBonuses(baseValue: number, bonuses: Bonus[]): number {
  const flat = bonuses.find((bonus) => bonus.type === "flat")
  if (flat) return flat.value

  return bonuses.reduce((value, bonus) => applyBonus(value, bonus), baseValue)
}

function resolveBonus(character: CharacterTemplate, bonus: Bonus): Bonus {
  const formula = bonus.formula?.trim()
  if (!formula) return bonus

  const value = evaluateCharacterSheetFormula(formula, character)
  return value === undefined ? bonus : { ...bonus, value }
}

function isConditionActive(condition: { duration?: { remaining?: number } }): boolean {
  return condition.duration?.remaining === undefined || condition.duration.remaining > 0
}

function isWeaponProficient(character: CharacterTemplate, weapon: Weapon): boolean {
  if (isWeaponImprovisedGrip(weapon)) return false
  if (weapon.proficient) return true

  const names = [weapon.name, ...(weapon.properties ?? []).map((property) => property.name)]
  return names.some((name) => hasProficiency(character, "weapon", name))
}

export function formatSavingThrowLabel(attribute: Attribute): string {
  return `${attributeShort(attribute)} ${formatSigned(getSavingThrowBonusPlaceholder(attribute))}`
}

function getSavingThrowBonusPlaceholder(_attribute: Attribute): number {
  return 0
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}
