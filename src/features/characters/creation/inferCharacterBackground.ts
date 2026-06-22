import type { CharacterBackground } from "../../../models/characters/CharacterBackground"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  cloneBackground,
  getCharacterBackground,
  withCharacterBackground,
} from "../../../models/characters/characterBackgroundStorage"
import { PHB_BACKGROUND_PRESETS } from "./phbPresets"

export function ensureCharacterBackgroundFromHistory(
  character: CharacterTemplate,
): CharacterTemplate {
  const existing = getCharacterBackground(character)
  if (existing) return withCharacterBackground(character, existing)

  const inferred = inferBackgroundFromHistory(character.get("profile").history)
  return inferred ? withCharacterBackground(character, inferred) : character
}

export function inferBackgroundFromHistory(
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
