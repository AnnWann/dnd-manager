import { applyProgressionAbilityConfig } from "../../data/classProgression/applyProgressionAbilityConfig"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { enforceAsiAttributeCaps } from "./enforceAsiAttributeCaps"
import { normalizeProgressionAbility } from "./ProgressionFeatureFinalization"
import { applyAdditionalProgressionFeatureMechanics } from "./ProgressionFeatureMechanicsAdditional"

export function refreshProgressionFeatureMechanics(
  character: CharacterTemplate,
): CharacterTemplate {
  const cappedCharacter = enforceAsiAttributeCaps(character)

  return cappedCharacter.with(
    "abilities",
    (cappedCharacter.get("abilities") ?? []).map((ability) =>
      applyProgressionAbilityConfig(
        applyAdditionalProgressionFeatureMechanics(
          cappedCharacter,
          normalizeProgressionAbility(cappedCharacter, ability),
        ),
      ),
    ),
  )
}
