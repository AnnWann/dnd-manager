import type { CharacterBackground } from "./CharacterBackground"
import type { CharacterTemplate } from "./CharacterTemplate"

const BACKGROUND_NOTE_PREFIX = "__dnd_manager_background__:"

export function getCharacterBackground(
  character: CharacterTemplate,
): CharacterBackground | undefined {
  const direct = character.get("profile").background
  if (direct) return cloneBackground(direct)

  const serialized = character
    .get("notes")
    .find((note) => note.startsWith(BACKGROUND_NOTE_PREFIX))

  if (!serialized) return undefined

  try {
    const parsed = JSON.parse(
      serialized.slice(BACKGROUND_NOTE_PREFIX.length),
    ) as CharacterBackground

    return parsed?.name ? cloneBackground(parsed) : undefined
  } catch {
    return undefined
  }
}

export function withCharacterBackground(
  character: CharacterTemplate,
  background: CharacterBackground,
): CharacterTemplate {
  const normalized = cloneBackground(background)
  const note = `${BACKGROUND_NOTE_PREFIX}${JSON.stringify(normalized)}`

  return character.withPatch({
    profile: {
      ...character.get("profile"),
      background: normalized,
    },
    notes: [
      ...character
        .get("notes")
        .filter((entry) => !entry.startsWith(BACKGROUND_NOTE_PREFIX)),
      note,
    ],
  })
}

export function withoutCharacterBackground(
  character: CharacterTemplate,
): CharacterTemplate {
  const { background: _background, ...profile } = character.get("profile")

  return character.withPatch({
    profile,
    notes: character
      .get("notes")
      .filter((entry) => !entry.startsWith(BACKGROUND_NOTE_PREFIX)),
  })
}

export function cloneBackground(
  background: CharacterBackground,
): CharacterBackground {
  return {
    ...background,
    skillProficiencies: [...(background.skillProficiencies ?? [])],
    proficiencies: (background.proficiencies ?? []).map((entry) => ({
      ...entry,
    })),
    startingEquipment: (background.startingEquipment ?? []).map((entry) => ({
      ...entry,
      id: entry.id || crypto.randomUUID(),
    })),
  }
}
