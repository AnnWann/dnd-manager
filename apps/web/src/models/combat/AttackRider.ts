import type { DamageType } from "./Damage"
import type { Attribute } from "../sheet/Attribute"
import { getWeaponAttackAttribute, isWeaponImprovisedGrip, type Weapon } from "../items/equipment/Weapon"
import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getCharacterConditions } from "../characters/characterConditionStorage"
import { getActiveAbilities, getEquippedItems } from "../characters/characterStats"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"

import { getAttackRiderDamageChoices, type AttackRider, type AttackRiderContext } from "../../../../../packages/game-core/src/attackRiders"
export type { AttackRider, AttackRiderContext, ParsedRiderDice } from "../../../../../packages/game-core/src/attackRiders"
export { parseAttackRiderDice, getWeaponRiderTransformation, resolveAttackRiderAttributeSelection, getAttackRiderDamageChoices, resolveAttackRiderDamageChoice } from "../../../../../packages/game-core/src/attackRiders"

/** Keep an item's own enchantment on the weapon granting it. */
function bindSourceWeapon(riders: readonly AttackRider[] | undefined, sourceItemId?: string): AttackRider[] {
  return (riders ?? []).map(rider => rider.weaponSelection === "sourceWeapon"
    ? { ...rider, weaponId: sourceItemId }
    : rider)
}

function defaultCastingAttribute(className: string): Attribute | undefined {
  if (["wizard", "artificer", "fighter", "rogue"].includes(className)) return "int"
  if (["cleric", "druid", "ranger"].includes(className)) return "wis"
  if (["bard", "paladin", "sorcerer", "warlock"].includes(className)) return "cha"
  return undefined
}

/** Effective modifier attribute shared by sheet previews and server rolls. */
export function getCharacterWeaponAttackAttribute(character: CharacterTemplate, weapon: Weapon): Attribute {
  const original = getWeaponAttackAttribute(weapon)
  if (isWeaponImprovisedGrip(weapon)) return original
  const override = getActiveAttackRiders(character, { scope: "weapon", weaponId: weapon.id })
    .filter(rider => rider.weaponAttackAttribute)
    .at(-1)
  if (!override?.weaponAttackAttribute) return original
  if (override.weaponAttackAttribute === "selected") return override.selectedWeaponAttribute ?? original
  if (override.weaponAttackAttribute !== "spellcasting") return override.weaponAttackAttribute
  const options = (character.get("sheet").classes ?? [])
    .filter(entry => !override.weaponSpellcastingClass || entry.className === override.weaponSpellcastingClass)
    .map(entry => entry.castingAttribute ?? defaultCastingAttribute(entry.className))
    .filter((attribute): attribute is Attribute => Boolean(attribute))
  if (!options.length) return original
  return options.reduce((best, attribute) =>
    character.getEffectiveAttributeModifier(attribute) > character.getEffectiveAttributeModifier(best)
      ? attribute : best)
}

/** No target supplied means a target-specific mark cannot trigger. */
export function getActiveAttackRiders(character: CharacterTemplate, context: AttackRiderContext): AttackRider[] {
  const activeConditions = getCharacterConditions(character)
    .filter(condition => condition.duration.remaining !== 0 || !["rounds", "turns", "minutes", "hours", "days"].includes(condition.duration.type))
  const equipped = getEquippedItems(character)
  const equipmentAbilities = new Set(equipped.flatMap(item => item.abilities ?? []))
  const riders: AttackRider[] = [
    ...equipped.flatMap(item => [
      ...bindSourceWeapon(item.bonuses?.attackRiders, item.id),
      ...(item.abilities ?? []).filter(isAbilityBenefitsActive)
        .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders, item.id)),
    ]),
    ...getActiveAbilities(character)
      .filter(ability => !equipmentAbilities.has(ability))
      .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders)),
    ...activeConditions.flatMap(condition => [
      ...bindSourceWeapon(condition.bonuses?.attackRiders, condition.sourceItemId),
      ...(condition.grantedAbilities ?? []).filter(isAbilityBenefitsActive)
        .flatMap(ability => bindSourceWeapon(ability.bonuses?.attackRiders, condition.sourceItemId)),
    ]),
  ]
  return riders
    .filter(rider => rider.scope === "all" || rider.scope === context.scope)
    .filter(rider => !rider.weaponSelection || Boolean(rider.weaponId))
    .filter(rider => !rider.weaponId || (context.scope === "weapon" && rider.weaponId === context.weaponId))
    .filter(rider => !rider.targetEntryId || rider.targetEntryId === context.targetEntryId)
}

/** Selection is requested for the active option only, not unrelated choices. */
export function abilityRequiresWeaponAttributeSelection(ability: Ability, optionId?: string): boolean {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return [
    ...(ability.bonuses?.attackRiders ?? []),
    ...granted.flatMap(child => child.bonuses?.attackRiders ?? []),
  ].some(rider => rider.scope === "weapon" && rider.weaponAttackAttribute === "selected")
}

export function optionRequiresWeaponSelection(ability: Ability, optionId?: string): boolean {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  if (!option) return false
  return (option.abilities ?? (option.ability ? [option.ability] : [])).some(granted =>
    (granted.bonuses?.attackRiders ?? []).some(rider => rider.weaponSelection === "onActivation"),
  )
}

export function getAbilityAttackRiderDamageChoices(ability: Ability, optionId?: string): DamageType[] {
  const option = ability.activationOptions?.find(entry => entry.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return getAttackRiderDamageChoices([
    ...(ability.bonuses?.attackRiders ?? []),
    ...granted.flatMap(entry => entry.bonuses?.attackRiders ?? []),
  ])
}
