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
export { parseAttackRiderDice, getUnarmedRiderDamageDice, getWeaponRiderTransformation, resolveAttackRiderAttributeSelection, getAttackRiderDamageChoices, resolveAttackRiderDamageChoice } from "../../../../../packages/game-core/src/attackRiders"

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

export type ActiveAttackRiderOrigin =
  | { type: "equipment"; itemId: string; label: string }
  | { type: "equipment-ability"; itemId: string; abilityId: string; label: string }
  | { type: "ability"; abilityId: string; label: string }
  | { type: "condition"; conditionId: string; label: string; sourceAbilityId?: string; sourceAbilityLocation?: "character" | "race" | "equipment" | "condition"; sourceItemId?: string }

export type ActiveAttackRiderEntry = {
  rider: AttackRider
  origin: ActiveAttackRiderOrigin
  /** Same rider has already been applied by another old effect. Never roll twice. */
  suppressedDuplicate?: boolean
}

/**
 * Resolve each weapon effect together with its owner. The weapon panel and the
 * authoritative attack roller must consume the same projection.
 */
export function getActiveAttackRiderEntries(
  character: CharacterTemplate,
  context: AttackRiderContext,
  options?: { includeDuplicates?: boolean; includeOtherTargets?: boolean },
): ActiveAttackRiderEntry[] {
  const activeConditions = getCharacterConditions(character)
    .filter(condition => condition.duration.remaining !== 0 || !["rounds", "turns", "minutes", "hours", "days"].includes(condition.duration.type))
  const equipped = getEquippedItems(character)
  const equipmentAbilities = new Set(equipped.flatMap(item => item.abilities ?? []))
  const grantedAbilityIds = new Set(activeConditions.flatMap(condition => (condition.grantedAbilities ?? []).map(ability => ability.id)))
  const entries: ActiveAttackRiderEntry[] = []

  for (const item of equipped) {
    for (const rider of bindSourceWeapon(item.bonuses?.attackRiders, item.id)) {
      entries.push({ rider, origin: { type: "equipment", itemId: item.id, label: item.name } })
    }
    for (const ability of item.abilities ?? []) {
      if (!isAbilityBenefitsActive(ability)) continue
      for (const rider of bindSourceWeapon(ability.bonuses?.attackRiders, item.id)) {
        entries.push({ rider, origin: { type: "equipment-ability", itemId: item.id, abilityId: ability.id, label: ability.name } })
      }
    }
  }

  for (const ability of getActiveAbilities(character)) {
    // The same ability object is already collected with its granting item or
    // condition. Reference identity is preserved by getActiveAbilities.
    if (equipmentAbilities.has(ability) || grantedAbilityIds.has(ability.id)) continue
    for (const rider of bindSourceWeapon(ability.bonuses?.attackRiders)) {
      entries.push({ rider, origin: { type: "ability", abilityId: ability.id, label: ability.name } })
    }
  }

  for (const condition of activeConditions) {
    const origin: ActiveAttackRiderOrigin = {
      type: "condition",
      conditionId: condition.id,
      label: condition.name,
      sourceAbilityId: condition.sourceAbilityId,
      sourceAbilityLocation: condition.sourceAbilityLocation,
      sourceItemId: condition.sourceItemId,
    }
    for (const rider of bindSourceWeapon(condition.bonuses?.attackRiders, condition.sourceItemId)) {
      entries.push({ rider, origin })
    }
    for (const ability of condition.grantedAbilities ?? []) {
      if (!isAbilityBenefitsActive(ability)) continue
      for (const rider of bindSourceWeapon(ability.bonuses?.attackRiders, condition.sourceItemId)) {
        entries.push({ rider, origin })
      }
    }
  }

  const seen = new Set<string>()
  return entries
    .filter(({ rider }) => rider.scope === "all" || rider.scope === context.scope)
    .filter(({ rider }) => !rider.weaponSelection || Boolean(rider.weaponId))
    .filter(({ rider }) => !rider.weaponId || (context.scope === "weapon" && rider.weaponId === context.weaponId))
    .filter(({ rider }) => options?.includeOtherTargets || !rider.targetEntryId || rider.targetEntryId === context.targetEntryId)
    .flatMap(entry => {
      // The weapon panel can reveal and delete suppressed historical effects,
      // while dice rollers receive only the first effective instance.
      const { rider } = entry
      const key = `${rider.id}:${rider.weaponId ?? "*"}:${rider.targetEntryId ?? "*"}`
      if (seen.has(key)) return options?.includeDuplicates ? [{ ...entry, suppressedDuplicate: true }] : []
      seen.add(key)
      return [entry]
    })
}

/** No target supplied means a target-specific mark cannot trigger. */
export function getActiveAttackRiders(character: CharacterTemplate, context: AttackRiderContext): AttackRider[] {
  return getActiveAttackRiderEntries(character, context).map(entry => entry.rider)
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

/** Read the base ability, the chosen option, and abilities granted by that option. */
export function getActivationWeaponRiders(ability: Ability, optionId?: string): AttackRider[] {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return [
    ...(ability.bonuses?.attackRiders ?? []),
    ...(option?.bonuses?.attackRiders ?? []),
    ...granted.flatMap(entry => entry.bonuses?.attackRiders ?? []),
  ].filter(rider => rider.scope === "weapon" && rider.weaponSelection === "onActivation")
}

export function optionRequiresWeaponSelection(ability: Ability, optionId?: string): boolean {
  return getActivationWeaponRiders(ability, optionId).length > 0
}

export function getAbilityAttackRiderDamageChoices(ability: Ability, optionId?: string): DamageType[] {
  const option = ability.activationOptions?.find(entry => entry.id === optionId)
  const granted = option?.abilities ?? (option?.ability ? [option.ability] : [])
  return getAttackRiderDamageChoices([
    ...(ability.bonuses?.attackRiders ?? []),
    ...granted.flatMap(entry => entry.bonuses?.attackRiders ?? []),
  ])
}
