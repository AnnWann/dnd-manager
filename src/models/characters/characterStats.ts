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

export function getEffectiveStat<K extends keyof Sheet["stats"]>(
  character: CharacterTemplate,
  stat: K,
): Sheet["stats"][K] {
  const baseValue = character.get("sheet").stats[stat]

  if (typeof baseValue !== "number") return baseValue

  const bonusKey = statToBonusKey(stat)
  if (!bonusKey) return baseValue

  const calculated = applyBonuses(
    baseValue,
    getCharacterBonuses(character, bonusKey),
  )
  const adjustmentKey = statToAdjustmentKey(stat)
  const adjustment = adjustmentKey
    ? character.get("sheet").stats[adjustmentKey] ?? 0
    : 0

  return (calculated + adjustment) as Sheet["stats"][K]
}

export function getCalculatedArmorClass(
  character: CharacterTemplate,
): number {
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

export function getEffectiveArmorClass(character: CharacterTemplate): number {
  return (
    getCalculatedArmorClass(character) +
    getStatAdjustment(character, "armorClassAdjustment")
  )
}

export function getCalculatedInitiative(
  character: CharacterTemplate,
): number {
  const dexModifier = getEffectiveAttributeModifier(character, "dex")

  return applyBonuses(
    dexModifier,
    getCharacterBonuses(character, "initiative"),
  )
}

export function getEffectiveInitiative(character: CharacterTemplate): number {
  return (
    getCalculatedInitiative(character) +
    getStatAdjustment(character, "initiativeAdjustment")
  )
}

export function getCalculatedPassivePerception(
  character: CharacterTemplate,
): number {
  let wisdomModifier = getEffectiveAttributeModifier(character, "wis")
  const perceptionProficiency = character.get("sheet").skills.perception

  if (perceptionProficiency === "proficient") {
    wisdomModifier += getProficiencyBonus(character)
  }

  if (perceptionProficiency === "expertise") {
    wisdomModifier += getProficiencyBonus(character) * 2
  }

  return applyBonuses(
    10 + wisdomModifier,
    getCharacterBonuses(character, "passivePerception"),
  )
}

export function getEffectivePassivePerception(
  character: CharacterTemplate,
): number {
  return (
    getCalculatedPassivePerception(character) +
    getStatAdjustment(character, "passivePerceptionAdjustment")
  )
}

export function getCalculatedMobility(character: CharacterTemplate): number {
  const sheet = character.get("sheet")
  const racialMobility = sheet.race.mobility
  const baseSpeed =
    typeof racialMobility === "number" && Number.isFinite(racialMobility)
      ? racialMobility
      : (sheet.stats.mobility ?? 9) + (sheet.race.speedBonus ?? 0)

  const unencumberedSpeed = applyBonuses(
    baseSpeed,
    getCharacterBonuses(character, "speed"),
  )

  return Math.max(
    0,
    unencumberedSpeed - getEncumbranceSpeedPenalty(character),
  )
}

export function getEffectiveMobility(character: CharacterTemplate): number {
  return Math.max(
    0,
    getCalculatedMobility(character) +
      getStatAdjustment(character, "mobilityAdjustment"),
  )
}

export function getStatAdjustment(
  character: CharacterTemplate,
  key: StatAdjustmentKey,
): number {
  const value = character.get("sheet").stats[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function getStatAdjustmentKey(
  stat: CalculatedStatKey,
): StatAdjustmentKey {
  if (stat === "armorClass") return "armorClassAdjustment"
  if (stat === "initiative") return "initiativeAdjustment"
  if (stat === "mobility") return "mobilityAdjustment"
  return "passivePerceptionAdjustment"
}

export function getEffectiveWeaponAttackBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  if (isWeaponImprovisedGrip(weapon)) {
    return getEffectiveAttackBonus(
      character,
      getEffectiveAttributeModifier(character, "str"),
    )
  }

  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined
  const modifierAttribute = getWeaponAttackAttribute(weapon)

  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "attackBonus"),
    ...getScopedCharacterBonuses(
      character,
      "weaponAttackBonus",
      modifierAttribute,
    ),
    ...(weaponAttackBonus ? [weaponAttackBonus] : []),
  ])
}

export function getEffectiveWeaponDamageBonus(
  character: CharacterTemplate,
  weapon: Weapon,
  baseValue: number,
): number {
  const modifierAttribute = isWeaponImprovisedGrip(weapon)
    ? "str"
    : getWeaponAttackAttribute(weapon)
  const effectiveBase = isWeaponImprovisedGrip(weapon)
    ? getEffectiveAttributeModifier(character, "str")
    : baseValue
  const weaponDamageBonus =
    !isWeaponImprovisedGrip(weapon) && weapon.bonuses?.damage?.bonus
      ? resolveBonus(character, weapon.bonuses.damage.bonus)
      : undefined

  return applyBonuses(effectiveBase, [
    ...getCharacterBonuses(character, "damageBonus"),
    ...getScopedCharacterBonuses(
      character,
      "weaponDamageBonus",
      modifierAttribute,
    ),
    ...(weaponDamageBonus ? [weaponDamageBonus] : []),
  ])
}

export function resolveBonus(
  character: CharacterTemplate,
  bonus: Bonus,
): Bonus {
  if (!bonus.formula?.trim()) return bonus
  const evaluated = evaluateCharacterSheetFormula(bonus.formula, character)
  return evaluated === undefined ? bonus : { ...bonus, value: evaluated }
}

function isConditionActive(
  condition: ReturnType<typeof getCharacterConditions>[number],
): boolean {
  if (typeof condition.duration.remaining === "number" && condition.duration.remaining <= 0) {
    return false
  }
  if (condition.duration.expiresAt) {
    const expiresAt = Date.parse(condition.duration.expiresAt)
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false
  }
  return true
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

function statToAdjustmentKey(
  stat: keyof Sheet["stats"],
): StatAdjustmentKey | undefined {
  if (stat === "armorClass") return "armorClassAdjustment"
  if (stat === "initiative") return "initiativeAdjustment"
  if (stat === "passive_perception") {
    return "passivePerceptionAdjustment"
  }
  if (stat === "mobility") return "mobilityAdjustment"

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
  const direct =
    character.get("sheet").savingThrowProficiencies?.[attribute] ?? false
  if (direct) return true

  const fullNames: Record<Attribute, string> = {
    str: "Força",
    dex: "Destreza",
    con: "Constituição",
    int: "Inteligência",
    wis: "Sabedoria",
    cha: "Carisma",
  }

  return [attribute, attributeShort(attribute), fullNames[attribute]].some(
    (name) => hasProficiency(character, "saving-throw", name),
  )
}

export function getSavingThrowBonus(
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  const attributeModifier =
    getEffectiveAttributeModifier(character, attribute)

  const baseValue = isSavingThrowProficient(character, attribute)
    ? attributeModifier + getProficiencyBonus(character)
    : attributeModifier

  return applyBonuses(baseValue, [
    ...getCharacterBonuses(character, "savingThrowBonus"),
    ...getScopedCharacterBonuses(
      character,
      "savingThrowAttributeBonus",
      attribute,
    ),
  ])
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
