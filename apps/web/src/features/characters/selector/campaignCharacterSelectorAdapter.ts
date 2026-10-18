import { CLASS_NAMES } from "../../../contexts/consts"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import {
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
} from "../../../models/characters/customClassConfig"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { CharacterSelectorItem } from "./CharacterSelectorItem"

export function toCampaignCharacterSelectorItem(
  character: CharacterTemplate,
  options: {
    showOwnerBadge: boolean
    getSpellByIndex: (
      spellIndex: string,
    ) => Spell | undefined
  },
): CharacterSelectorItem {
  const sheet = character.get("sheet")
  const classes = sheet.classes ?? []

  const level = classes.reduce(
    (total, entry) => total + (entry.level ?? 0),
    0,
  )

  const classLabel = classes
    .map((entry) =>
      isCustomClassEntry(entry)
        ? getCustomClassConfigFromEntry(entry)?.name ?? String(entry.className)
        : CLASS_NAMES[entry.className] ?? entry.className,
    )
    .filter(Boolean)
    .join(" / ")

  const visibility = character.get("visibility")
  const owner = character.get("owner")

  return {
    id: character.get("id"),
    name: character.get("name"),
    level,
    classLabel,
    imageUrl: character.get("profile").imageUrl,
    spellCount: getAvailableSpellCount(
      character,
      options.getSpellByIndex,
    ),

    badge: options.showOwnerBadge
      ? visibility === "master"
        ? "Master"
        : `Player: ${owner?.name?.trim() || "sem nome"}`
      : undefined,
  }
}

function getAvailableSpellCount(
  character: CharacterTemplate,
  getSpellByIndex: (
    spellIndex: string,
  ) => Spell | undefined,
): number {
  const indexes = new Set<string>()

  for (
    const knownSpell of
      character.get("magic")?.spells.knownSpells ?? []
  ) {
    indexes.add(knownSpell.spells.id)
  }

  for (
    const grantedSpell of
      getCharacterGrantedSpells(character)
  ) {
    indexes.add(grantedSpell.index)
  }

  return Array.from(indexes).filter((index) =>
    Boolean(getSpellByIndex(index)),
  ).length
}
