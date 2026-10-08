import type { DamageType } from "./Damage"
import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { getCharacterConditions } from "../characters/characterConditionStorage"
import { getActiveAbilities, getEquippedItems } from "../characters/characterStats"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"

/** Additional attack effects supplied by equipment, abilities or active conditions. */
export type AttackRider = {
  id: string
  label: string
  /** 'all' covers weapon, unarmed and spell attacks. */
  scope: "all" | "weapon" | "unarmed" | "spell"
  /** Restrict an effect to one weapon (e.g. Elemental Cleaver). */
  weaponId?: string
  /** Select an equipped weapon when activating a stance or elemental infusion. */
  weaponSelection?: "onActivation"
  /** Restrict a mark to the selected combatant, never to all opponents. */
  targetEntryId?: string
  /** A marked target is chosen when the spell is cast. */
  targetSelection?: "onCast"
  /** Rolled once per successful hit; its type is independent of the base damage. */
  damage?: { dice: string; damageType?: DamageType }
  /** When present, a player must choose one of these types at activation/cast. */
  damageTypeChoices?: DamageType[]
  /** Changes only the base weapon damage packet, not other typed riders. */
  replaceWeaponDamageType?: DamageType
  /** Temporary weapon properties, without mutating the saved inventory item. */
  addThrown?: boolean
  thrownNormalRange?: number
  thrownLongRange?: number
  returnsAfterThrow?: boolean
}

export type AttackRiderContext = {
  scope: "weapon" | "unarmed" | "spell"
  weaponId?: string
  targetEntryId?: string
}

/** No target supplied means a target-specific mark cannot trigger. */
export function getActiveAttackRiders(character: CharacterTemplate, context: AttackRiderContext): AttackRider[] {
  const activeConditions = getCharacterConditions(character)
    .filter(condition => condition.duration.remaining !== 0 || !["rounds", "turns", "minutes", "hours", "days"].includes(condition.duration.type))
  const collections = [
    ...getEquippedItems(character).map(item => item.bonuses),
    ...getActiveAbilities(character).map(ability => ability.bonuses),
    ...activeConditions.map(condition => condition.bonuses),
    ...activeConditions.flatMap(condition => condition.grantedAbilities ?? [])
      .filter(isAbilityBenefitsActive)
      .map(ability => ability.bonuses),
  ]
  return collections.flatMap(bonuses => bonuses?.attackRiders ?? [])
    .filter(rider => rider.scope === "all" || rider.scope === context.scope)
    .filter(rider => rider.weaponSelection !== "onActivation" || Boolean(rider.weaponId))
    .filter(rider => !rider.weaponId || (context.scope === "weapon" && rider.weaponId === context.weaponId))
    .filter(rider => !rider.targetEntryId || rider.targetEntryId === context.targetEntryId)
}

export type ParsedRiderDice = { quantity: number; sides: number; flat: number }

/** Bounded numeric parser; never evaluate player-supplied expressions on the server. */
export function parseAttackRiderDice(dice: string): ParsedRiderDice | undefined {
  const value = dice.trim().replace(/\s+/g, "").toLowerCase()
  const match = /^(\d{1,2})d(4|6|8|10|12|20)([+-]\d{1,3})?$/.exec(value)
  if (!match) return undefined
  const quantity = Number(match[1])
  const flat = Number(match[3] ?? 0)
  if (quantity < 1 || quantity > 20 || Math.abs(flat) > 100) return undefined
  return { quantity, sides: Number(match[2]), flat }
}

export function getWeaponRiderTransformation(riders: readonly AttackRider[]) {
  const replacement = [...riders].reverse().find(rider => rider.replaceWeaponDamageType)?.replaceWeaponDamageType
  const thrown = riders.some(rider => rider.addThrown)
  const returnAfterThrow = riders.some(rider => rider.returnsAfterThrow)
  const throwing = riders.find(rider => rider.addThrown && rider.thrownNormalRange && rider.thrownLongRange)
  return {
    damageType: replacement,
    thrown,
    thrownNormalRange: throwing?.thrownNormalRange,
    thrownLongRange: throwing?.thrownLongRange,
    returnsAfterThrow: returnAfterThrow,
  }
}

export function optionRequiresWeaponSelection(ability: Ability, optionId?: string): boolean {
  const option = ability.activationOptions?.find(candidate => candidate.id === optionId)
  if (!option) return false
  return (option.abilities ?? (option.ability ? [option.ability] : [])).some(granted =>
    (granted.bonuses?.attackRiders ?? []).some(rider => rider.weaponSelection === "onActivation"),
  )
}

/** One choice can power all selectable riders on the same activation. */
export function getAttackRiderDamageChoices(riders: readonly AttackRider[]): DamageType[] {
  const groups = riders.map(rider => rider.damageTypeChoices ?? []).filter(group => group.length)
  if (!groups.length) return []
  return [...new Set(groups[0])].filter(type => groups.every(group => group.includes(type)))
}

export function resolveAttackRiderDamageChoice(
  riders: readonly AttackRider[],
  chosenType?: DamageType,
): AttackRider[] {
  const allowed = getAttackRiderDamageChoices(riders)
  if (allowed.length && (!chosenType || !allowed.includes(chosenType))) {
    throw new Error("Escolha um tipo de dano permitido para este efeito.")
  }
  return riders.map(rider =>
    rider.damageTypeChoices?.length && chosenType
      ? {
          ...rider,
          damage: rider.damage ? { ...rider.damage, damageType: chosenType } : undefined,
          replaceWeaponDamageType: rider.replaceWeaponDamageType ? chosenType : undefined,
        }
      : rider,
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
