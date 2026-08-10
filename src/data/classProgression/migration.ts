import {
  withCharacterAsis,
} from "../../models/characters/CharacterAsi"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"

/** Automatic class progression synchronization is intentionally disabled. */
export const CLASS_PROGRESSION_DATA_VERSION = 0

export function migrateCharacterProgressionData(
  character: CharacterTemplate,
): CharacterTemplate {
  const mirroredAsi = character.get("magic")?.asi
  return Array.isArray(mirroredAsi) && mirroredAsi.length
    ? withCharacterAsis(character, mirroredAsi)
    : character
}
