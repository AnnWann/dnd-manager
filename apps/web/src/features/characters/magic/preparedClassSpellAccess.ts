import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { CharacterClassInterface, ClassName } from "../../../models/sheet/Class"

export const PREPARED_CLASS_LIST_MARKER = "class-list-access:official"
export const PREPARED_CLASS_NAMES = new Set<ClassName>([
  "artificer",
  "cleric",
  "druid",
  "paladin",
])

type KnownSpellEntry = CharacterSpells["knownSpells"][number]

export type PreparedClassSpellCatalogEntry = {
  classEntry: CharacterClassInterface
  spellIndex: string
}

export function isPreparedClass(classEntry: CharacterClassInterface | undefined): boolean {
  return classEntry?.knownSpells?.mode === "prepared-only"
}

export function isPreparedClassName(className: string): className is ClassName {
  return PREPARED_CLASS_NAMES.has(className as ClassName)
}

export function maximumPreparedClassSpellLevel(classEntry: CharacterClassInterface): number {
  if (!isPreparedClass(classEntry)) return 0
  const level = classEntry.level
  switch (classEntry.className) {
    case "artificer":
      return Math.min(5, Math.floor((Math.max(1, level) - 1) / 4) + 1)
    case "cleric":
    case "druid":
      return Math.min(9, Math.ceil(level / 2))
    case "paladin":
      return level < 2
        ? 0
        : Math.min(5, Math.floor((level - 1) / 4) + 1)
    default:
      return 0
  }
}

export function preparedClassSpellSource(classEntry: CharacterClassInterface): SpellSource {
  return {
    type: "class",
    sourceId: classEntry.className,
    name: classEntry.className,
    attribute: classEntry.castingAttribute ?? defaultCastingAttribute(classEntry.className),
  }
}

export function isPreparedClassListEntry(notes: string | undefined): boolean {
  return notes?.trim() === PREPARED_CLASS_LIST_MARKER
}

export function reconcilePreparedClassKnownSpells(
  character: CharacterTemplate,
  catalogEntries: readonly PreparedClassSpellCatalogEntry[],
): CharacterTemplate {
  const currentKnown = character.get("magic")?.spells.knownSpells ?? []
  const accessibleIndexes = new Set(
    catalogEntries.map((entry) => entry.spellIndex.trim()).filter(Boolean),
  )
  const knownIndexes = new Set(currentKnown.map((entry) => entry.spells.id))
  let next = character

  for (const entry of currentKnown) {
    if (!isPreparedClassListEntry(entry.acquisition?.notes)) continue
    if (accessibleIndexes.has(entry.spells.id)) continue

    next = next.removeSpell(entry.spells.id)
    knownIndexes.delete(entry.spells.id)
  }

  const characterLevel = (character.get("sheet").classes ?? []).reduce(
    (total, classEntry) => total + classEntry.level,
    0,
  )

  for (const access of catalogEntries) {
    const spellIndex = access.spellIndex.trim()
    if (!spellIndex || knownIndexes.has(spellIndex)) continue

    const className = access.classEntry.className
    const spellEntry: KnownSpellEntry = {
      spells: {
        id: spellIndex,
        prepared: false,
      },
      source: preparedClassSpellSource(access.classEntry),
      acquisition: createCharacterAcquisition({
        characterLevel,
        className,
        classLevel: access.classEntry.level,
        sourceType: "class",
        sourceId: className,
        sourceName: className,
        reason: "level-up",
        notes: PREPARED_CLASS_LIST_MARKER,
      }),
    }

    next = next.addSpell(spellEntry)
    knownIndexes.add(spellIndex)
  }

  return next
}

function defaultCastingAttribute(className: ClassName) {
  if (className === "artificer") return "int" as const
  if (className === "paladin") return "cha" as const
  return "wis" as const
}
