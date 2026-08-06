import { applyAdditionalProgressionLocalization } from "../../models/leveling/ProgressionAdditionalLocalization"
import { localizeProgressionDefinitions } from "../../models/leveling/ProgressionLocalization"
import { localizeRemainingSubclasses } from "../../models/leveling/SubclassLocalization"
import type { ClassName } from "../../models/sheet/Class"
import { artificerProgression } from "./classes/artificer"
import { barbarianProgression } from "./classes/barbarian"
import { bardProgression } from "./classes/bard"
import { clericProgression } from "./classes/cleric"
import { druidProgression } from "./classes/druid"
import { fighterProgression } from "./classes/fighter"
import { monkProgression } from "./classes/monk"
import { paladinProgression } from "./classes/paladin"
import { rangerProgression } from "./classes/ranger"
import { rogueProgression } from "./classes/rogue"
import { sorcererProgression } from "./classes/sorcerer"
import { warlockProgression } from "./classes/warlock"
import { wizardProgression } from "./classes/wizard"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
} from "./types"

export const CLASS_PROGRESSION_MODULES = [
  artificerProgression,
  barbarianProgression,
  bardProgression,
  clericProgression,
  druidProgression,
  fighterProgression,
  monkProgression,
  paladinProgression,
  rangerProgression,
  rogueProgression,
  sorcererProgression,
  warlockProgression,
  wizardProgression,
] as const

export const CLASS_PROGRESSIONS: Record<
  ClassName,
  ClassProgressionDefinition
> = {
  artificer: artificerProgression,
  barbarian: barbarianProgression,
  bard: bardProgression,
  cleric: clericProgression,
  druid: druidProgression,
  fighter: fighterProgression,
  monk: monkProgression,
  paladin: paladinProgression,
  ranger: rangerProgression,
  rogue: rogueProgression,
  sorcerer: sorcererProgression,
  warlock: warlockProgression,
  wizard: wizardProgression,
}

localizeProgressionDefinitions(CLASS_PROGRESSIONS)
applyAdditionalProgressionLocalization(CLASS_PROGRESSIONS)
localizeRemainingSubclasses(CLASS_PROGRESSIONS)

export function getClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
  return CLASS_PROGRESSIONS[className]
}

export function getFeaturesAtLevel(
  className: ClassName,
  level: number,
  subclassId?: string,
): LevelFeatureDefinition[] {
  const progression = getClassProgression(className)
  const subclass = progression.subclasses.find(
    (entry) => entry.id === subclassId,
  )

  return [
    ...progression.features.filter((feature) => feature.level === level),
    ...(subclass?.features.filter((feature) => feature.level === level) ?? []),
  ]
}

export function getCantripsKnownAtLevel(
  className: ClassName,
  level: number,
): number {
  const entries = Object.entries(
    getClassProgression(className).cantripsKnown ?? {},
  )
    .map(([minimumLevel, count]) => [Number(minimumLevel), count] as const)
    .filter(([minimumLevel]) => minimumLevel <= level)
    .toSorted((left, right) => left[0] - right[0])

  return entries.at(-1)?.[1] ?? 0
}
