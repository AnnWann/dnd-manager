import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type {
  Ability,
  AbilityEffectDuration,
  Usage,
} from "./Ability"

export function getAbilityEffectDuration(
  ability: Ability,
): AbilityEffectDuration {
  if ((ability.kind ?? "active") !== "active") return "lasting"
  return ability.effectDuration ?? "instant"
}

export function abilityRequiresActivation(ability: Ability): boolean {
  if ((ability.kind ?? "active") === "active") return true

  const trigger = (ability.trigger ?? "always")
    .trim()
    .toLocaleLowerCase("pt-BR")

  return trigger !== "" && trigger !== "always" && trigger !== "sempre"
}

export function isAbilityBenefitsActive(ability: Ability): boolean {
  if (!abilityRequiresActivation(ability)) return true
  return ability.benefitsActive === true
}

export function getAbilityUsageMax(
  character: CharacterTemplate,
  usage: Usage,
): number {
  const formula = usage.maxFormula?.trim()
  const resolved = formula
    ? evaluateCharacterSheetFormula(formula, character)
    : undefined
  const fallback = Number.isFinite(usage.max) ? usage.max : 0
  const value = resolved ?? fallback

  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
}

export function getAbilityRemainingUses(
  character: CharacterTemplate,
  usage: Usage,
): number {
  return Math.max(0, getAbilityUsageMax(character, usage) - usage.used)
}

export function canActivateAbility(
  character: CharacterTemplate,
  ability: Ability,
): boolean {
  if (abilityRequiresActivation(ability) && isAbilityBenefitsActive(ability)) {
    return false
  }

  const usage = ability.usage
  if (!usage || usage.reset === "spellSlot") return true
  return usage.used < getAbilityUsageMax(character, usage)
}

export function activateAbilityBenefits(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (!abilityRequiresActivation(ability)) return ability
  if (!canActivateAbility(character, ability)) return ability

  const usage = ability.usage
  return {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "active"
        ? getAbilityEffectDuration(ability)
        : ability.effectDuration,
    benefitsActive: true,
    modifiersActive: undefined,
    usage:
      usage && usage.reset !== "spellSlot"
        ? {
            ...usage,
            used: Math.min(
              getAbilityUsageMax(character, usage),
              usage.used + 1,
            ),
          }
        : usage,
  }
}

export function deactivateAbilityBenefits(ability: Ability): Ability {
  if (!abilityRequiresActivation(ability)) return ability
  return {
    ...ability,
    benefitsActive: false,
    modifiersActive: undefined,
  }
}

export function restoreAbilityUse(ability: Ability): Ability {
  if (!ability.usage || ability.usage.reset === "spellSlot") return ability

  return {
    ...ability,
    usage: {
      ...ability.usage,
      used: Math.max(0, ability.usage.used - 1),
    },
  }
}

export function normalizeAbilityActivation(ability: Ability): Ability {
  const normalized = {
    ...ability,
    effectDuration:
      (ability.kind ?? "active") === "active"
        ? getAbilityEffectDuration(ability)
        : ability.effectDuration,
    modifiersActive: undefined,
  }

  if (!abilityRequiresActivation(normalized)) {
    return {
      ...normalized,
      benefitsActive: undefined,
    }
  }

  return {
    ...normalized,
    benefitsActive: normalized.benefitsActive === true,
  }
}
