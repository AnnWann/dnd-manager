import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
} from "./types"

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
    cantripsKnown: {},
  }
}

/**
 * Only minimal mechanical class references are bundled. No subclass names,
 * feature names, feature text, choice lists, spell grants or progression tables
 * are shipped here.
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

/** Compatibility export: there are intentionally no bundled progression modules. */
export const CLASS_PROGRESSION_MODULES = [] as const

export function getClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
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

/** Cantrip limits are no longer inferred by progression. */
export function getCantripsKnownAtLevel(
  _className: ClassName,
  _level: number,
): number {
  return 0
}
