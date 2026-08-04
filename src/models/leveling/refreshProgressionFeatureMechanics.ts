import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { normalizeProgressionAbility } from "./ProgressionFeatureFinalization"
import { applyAdditionalProgressionFeatureMechanics } from "./ProgressionFeatureMechanicsAdditional"

export function refreshProgressionFeatureMechanics(
  character: CharacterTemplate,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      applyAdditionalProgressionFeatureMechanics(
        character,
        normalizeProgressionAbility(character, ability),
      ),
    ),
  )
}
