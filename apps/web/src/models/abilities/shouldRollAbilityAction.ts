import type { Ability } from "./Ability"
import { abilityHasSelfDamage } from "./abilitySelfDamage"
import { listBonusRollRequirements } from "../bonuses/BonusRoll"

/**
 * Standard ability use already rolls activation bonus dice on the authoritative
 * server and records them with the ability itself. A second action-roll request
 * would display the same use twice (and can produce inconsistent totals).
 *
 * Abilities with an explicit attack/check roll and no activation dice retain
 * their independent action roll until both are resolved in one server operation.
 */
export function shouldRequestSeparateAbilityActionRoll(
  ability: Ability,
  activationOptionId?: string,
): boolean {
  if (!ability.roll || abilityHasSelfDamage(ability)) return false
  const option = ability.activationOptions?.find(entry => entry.id === activationOptionId)
  return listBonusRollRequirements(ability.bonuses).length === 0
    && listBonusRollRequirements(option?.bonuses).length === 0
}
