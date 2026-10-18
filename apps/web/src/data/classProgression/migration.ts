import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"

/** Automatic class progression synchronization is intentionally disabled. */
export const CLASS_PROGRESSION_DATA_VERSION = 0

export function migrateCharacterProgressionData(
  character: CharacterTemplate,
): CharacterTemplate {
  return character
}
