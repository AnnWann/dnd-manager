import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { normalizeProgressionAbility } from "./ProgressionFeatureFinalization"

export function refreshProgressionFeatureMechanics(
  character: CharacterTemplate,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      normalizeProgressionAbility(character, ability),
    ),
  )
}
