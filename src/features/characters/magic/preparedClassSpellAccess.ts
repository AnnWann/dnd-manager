import type { CharacterClassInterface, ClassName } from "../../../models/sheet/Class"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"

export const PREPARED_CLASS_LIST_MARKER = "class-list-access:official"
export const PREPARED_CLASS_NAMES = new Set<ClassName>([
  "artificer",
  "cleric",
  "druid",
  "paladin",
])

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
    case "artificer": return Math.min(5, Math.ceil(level / 2))
    case "cleric":
    case "druid": return Math.min(9, Math.ceil(level / 2))
    case "paladin": return level < 2 ? 0 : Math.min(5, Math.ceil((level - 1) / 2))
    default: return 0
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

function defaultCastingAttribute(className: ClassName) {
  if (className === "artificer") return "int" as const
  if (className === "paladin") return "cha" as const
  return "wis" as const
}
