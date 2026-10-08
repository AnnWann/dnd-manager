import type { DamageType } from "./Damage"
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
  /** Restrict a mark to the selected combatant, never to all opponents. */
  targetEntryId?: string
  /** Rolled once per successful hit; its type is independent of the base damage. */
  damage?: { dice: string; damageType?: DamageType }
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
    .filter(rider => !rider.weaponId || (context.scope === "weapon" && rider.weaponId === context.weaponId))
    .filter(rider => !rider.targetEntryId || rider.targetEntryId === context.targetEntryId)
}

export type ParsedRiderDice = { quantity: number; sides: number; flat: number }

/** Bounded numeric parser; never evaluate player-supplied expressions on the server. */
export function parseAttackRiderDice(dice: string): ParsedRiderDice | undefined {
  const value = dice.trim().replace(/\\s+/g, "").toLowerCase()
  const match = /^(\\d{1,2})d(4|6|8|10|12|20)([+-]\\d{1,3})?$/.exec(value)
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
