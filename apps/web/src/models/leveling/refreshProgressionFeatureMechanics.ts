import {
  applyProgressionAbilityConfig,
  hasProgressionAbilityConfig,
} from "../../data/classProgression/applyProgressionAbilityConfig"
import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { enforceAsiAttributeCaps } from "./enforceAsiAttributeCaps"
import { normalizeProgressionAbility } from "./ProgressionFeatureFinalization"
import { applyAdditionalProgressionFeatureMechanics } from "./ProgressionFeatureMechanicsAdditional"

/** Refreshes only progression abilities, preserving character-owned state. */
export function refreshProgressionAbilityDefinitions(
  character: CharacterTemplate,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      refreshProgressionAbility(character, ability),
    ),
  )
}

export function refreshProgressionFeatureMechanics(
  character: CharacterTemplate,
): CharacterTemplate {
  return refreshProgressionAbilityDefinitions(enforceAsiAttributeCaps(character))
}

function refreshProgressionAbility(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  const hasCanonicalConfiguration = hasProgressionAbilityConfig(ability)
  const normalized = hasCanonicalConfiguration
    ? ability
    : normalizeProgressionAbility(character, ability)
  const withLegacyFallback = hasCanonicalConfiguration
    ? normalized
    : applyAdditionalProgressionFeatureMechanics(character, normalized)

  return applyProgressionAbilityConfig(withLegacyFallback)
}
