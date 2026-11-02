import type { Ability } from "./Ability"
import { hasAbilityResourceCosts } from "./abilityResourceCosts"
import { abilityHasSelfDamage } from "./abilitySelfDamage"
import { hasManualBonusRolls, listBonusRollRequirements } from "../bonuses/BonusRoll"
import { abilityRequiresWeaponAttributeSelection, getAbilityAttackRiderDamageChoices, optionRequiresWeaponSelection } from "../combat/AttackRider"

/** Shared by the Actions and Abilities tabs so every activation collects the same inputs. */
export function abilityNeedsActivationDialog(ability: Ability, physicalDiceMode = false): boolean {
  const options = ability.activationOptions ?? []
  return Boolean(
    ability.manualInputs?.length
    || options.length
    || optionRequiresWeaponSelection(ability)
    || abilityRequiresWeaponAttributeSelection(ability)
    || getAbilityAttackRiderDamageChoices(ability).length
    || options.some(option => optionRequiresWeaponSelection(ability, option.id)
      || abilityRequiresWeaponAttributeSelection(ability, option.id)
      || getAbilityAttackRiderDamageChoices(ability, option.id).length)
    || hasAbilityResourceCosts(ability)
    || abilityHasSelfDamage(ability)
    || ability.resourceUpcast?.enabled
    || hasManualBonusRolls(ability.bonuses)
    || (physicalDiceMode && listBonusRollRequirements(ability.bonuses).length)
    || ability.targeting?.mode === "targets"
    || ability.targeting?.mode === "point"
  )
}
