import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
} from "./types"

const CUSTOM_CLASS_RUNTIME_ID = "__custom__"

export const ALL_CLASS_NAMES: readonly ClassName[] = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]

function thresholdTable(
  entries: Array<[number, number]>,
): Partial<Record<number, number>> {
  const result: Partial<Record<number, number>> = {}
  let current = 0

  for (let level = 1; level <= 20; level += 1) {
    const threshold = entries.find(([entryLevel]) => entryLevel === level)
    if (threshold) current = threshold[1]
    result[level] = current
  }

  return result
}

const CANTRIP_PROGRESSION: Partial<
  Record<ClassName, Partial<Record<number, number>>>
> = {
  artificer: thresholdTable([[1, 2], [10, 3], [14, 4]]),
  bard: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  cleric: thresholdTable([[1, 3], [4, 4], [10, 5]]),
  druid: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  sorcerer: thresholdTable([[1, 4], [4, 5], [10, 6]]),
  warlock: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  wizard: thresholdTable([[1, 3], [4, 4], [10, 5]]),
}

function classReference(
  className: ClassName,
  label: string,
  hitDie: ClassProgressionDefinition["hitDie"],
): ClassProgressionDefinition {
  return {
    className,
    label,
    hitDie,
    source: "manual",
    subclassLevel: 20,
    features: [],
    subclasses: [],
    cantripsKnown: CANTRIP_PROGRESSION[className] ?? {},
  }
}

const CUSTOM_CLASS_REFERENCE = classReference(
  CUSTOM_CLASS_RUNTIME_ID as ClassName,
  "Classe personalizada",
  "d8",
)

/**
 * Only structural class metadata is bundled: identifiers, labels, hit dice and
 * public spell-count progression. No subclass names, feature names, rules text,
 * choice catalogs or spell grants are shipped here.
 */
export const CLASS_PROGRESSIONS: Record<ClassName, ClassProgressionDefinition> = {
  artificer: classReference("artificer", "Artífice", "d8"),
  barbarian: classReference("barbarian", "Bárbaro", "d12"),
  bard: classReference("bard", "Bardo", "d8"),
  cleric: classReference("cleric", "Clérigo", "d8"),
  druid: classReference("druid", "Druida", "d8"),
  fighter: classReference("fighter", "Guerreiro", "d10"),
  monk: classReference("monk", "Monge", "d8"),
  paladin: classReference("paladin", "Paladino", "d10"),
  ranger: classReference("ranger", "Patrulheiro", "d10"),
  rogue: classReference("rogue", "Ladino", "d8"),
  sorcerer: classReference("sorcerer", "Feiticeiro", "d6"),
  warlock: classReference("warlock", "Bruxo", "d8"),
  wizard: classReference("wizard", "Mago", "d6"),
}

/** Compatibility export: there are intentionally no bundled feature modules. */
export const CLASS_PROGRESSION_MODULES = [] as const

export function getClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) return CUSTOM_CLASS_REFERENCE
  return CLASS_PROGRESSIONS[className]
}

/** Bundled progression never materializes class/subclass features. */
export function getFeaturesAtLevel(
  _className: ClassName,
  _level: number,
  _subclassId?: string,
): LevelFeatureDefinition[] {
  return []
}

export function getCantripsKnownAtLevel(
  className: ClassName,
  level: number,
): number {
  if (String(className) === CUSTOM_CLASS_RUNTIME_ID) return 0
  const normalizedLevel = Math.max(1, Math.min(20, Math.trunc(level || 1)))
  return CLASS_PROGRESSIONS[className].cantripsKnown?.[normalizedLevel] ?? 0
}
