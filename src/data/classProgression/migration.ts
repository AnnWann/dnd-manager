import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import { refreshProgressionAbilityDefinitions } from "../../models/leveling/refreshProgressionFeatureMechanics"

/** Increment whenever canonical feature content or mechanics require resync. */
export const CLASS_PROGRESSION_DATA_VERSION = 1

export function migrateCharacterProgressionData(
  character: CharacterTemplate,
): CharacterTemplate {
  const currentVersion = character.get("classProgressionVersion") ?? 0
  if (currentVersion >= CLASS_PROGRESSION_DATA_VERSION) return character

  return refreshProgressionAbilityDefinitions(character).with(
    "classProgressionVersion",
    CLASS_PROGRESSION_DATA_VERSION,
  )
}
