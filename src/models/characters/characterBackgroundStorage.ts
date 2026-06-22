import type { CharacterBackground } from "./CharacterBackground"
import type { CharacterTemplate } from "./CharacterTemplate"
import { PHB_BACKGROUND_PRESETS } from "../../features/characters/creation/phbPresets"

const BACKGROUND_NOTE_PREFIX = "__dnd_manager_background__:"

export function getCharacterBackground(
  character: CharacterTemplate,
): CharacterBackground | undefined {
  const direct = character.get("profile").background
  if (direct) return cloneBackground(direct)

  const serialized = character
    .get("notes")
    .find((note) => note.startsWith(BACKGROUND_NOTE_PREFIX))

  if (serialized) {
    try {
      const parsed = JSON.parse(
        serialized.slice(BACKGROUND_NOTE_PREFIX.length),
      ) as CharacterBackground

      if (parsed?.name) return cloneBackground(parsed)
    } catch {
      // Ignore malformed legacy metadata and try the history fallback.
    }
  }

  return inferBackgroundFromHistory(character.get("profile").history)
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

export function ensureCharacterBackgroundStored(
  character: CharacterTemplate,
): CharacterTemplate {
  const background = getCharacterBackground(character)
  return background ? withCharacterBackground(character, background) : character
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

function inferBackgroundFromHistory(
  history: string,
): CharacterBackground | undefined {
  const lines = history
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const firstLine = lines[0] ?? ""
  const match = firstLine.match(/^Antecedente:\s*(.+)$/i)
  if (!match) return undefined

  const name = match[1].trim()
  const preset = PHB_BACKGROUND_PRESETS.find(
    (entry) => normalizeText(entry.name) === normalizeText(name),
  )

  if (preset) return cloneBackground(preset)

  const featureIndex = lines.findIndex((line) =>
    /^Característica:/i.test(line),
  )
  const featureName =
    featureIndex >= 0
      ? lines[featureIndex].replace(/^Característica:\s*/i, "")
      : ""
  const descriptionLines = lines.slice(
    1,
    featureIndex >= 0 ? featureIndex : lines.length,
  )
  const featureDescription =
    featureIndex >= 0 ? lines.slice(featureIndex + 1).join("\n") : ""

  return {
    id: "custom",
    name,
    description: descriptionLines.join("\n"),
    skillProficiencies: [],
    proficiencies: [],
    startingEquipment: [],
    featureName,
    featureDescription,
    custom: true,
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}
