import { CLASS_NAMES } from "../../../contexts/consts"
import {
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
} from "../../../models/characters/customClassConfig"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { CharacterSelectorItem } from "./CharacterSelectorItem"

export function toSessionCharacterSelectorItem(
  character: CharacterTemplate,
): CharacterSelectorItem {
  const classes = character.get("sheet").classes ?? []
  const level = classes.reduce(
    (total, entry) => total + Number(entry.level ?? 0),
    0,
  )
  const classLabel = classes
    .map((entry) =>
      isCustomClassEntry(entry)
        ? getCustomClassConfigFromEntry(entry)?.name ?? "Classe personalizada"
        : CLASS_NAMES[entry.className] ?? entry.className,
    )
    .filter(Boolean)
    .join(" / ")
  const spellCount = character.get("magic")?.spells.knownSpells?.length ?? 0

  return {
    id: character.get("id"),
    name: character.get("name"),
    level,
    classLabel,
    spellCount,
    imageUrl: character.get("profile").imageUrl,
  }
}
