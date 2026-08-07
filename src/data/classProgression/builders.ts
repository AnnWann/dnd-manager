export {
  defineProgressionAbility,
  grantProgressionSpell,
  progressionUsage,
} from "./ability"
export type {
  ProgressionAbilityConfig,
  ProgressionAbilityUsageConfig,
  ProgressionSpellGrant,
} from "./ability"

import type { ClassName, ClassSourceBook } from "../../models/sheet/Class"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
  SubclassDefinition,
} from "./types"

export type FeatureConfigurationInput = Omit<
  LevelFeatureDefinition,
  "id"
> & {
  id?: string
}

export type FeatureExtra = Omit<
  Partial<LevelFeatureDefinition>,
  "level" | "name" | "source"
>

export function defineFeature(
  input: FeatureConfigurationInput,
): LevelFeatureDefinition {
  return {
    ...input,
    id: input.id ?? createFeatureId(input.name, input.level),
  }
}

export function feature(
  level: number,
  name: string,
  source: ClassSourceBook = "PHB",
  extra: FeatureExtra = {},
): LevelFeatureDefinition {
  return defineFeature({
    level,
    name,
    source,
    ...extra,
  })
}

export function defineSubclass<TClassName extends ClassName>(
  input: SubclassDefinition<TClassName>,
): SubclassDefinition<TClassName> {
  return input
}

export function defineClassProgression<TClassName extends ClassName>(
  input: ClassProgressionDefinition<TClassName>,
): ClassProgressionDefinition<TClassName> {
  return input
}

export function createFeatureId(name: string, level: number): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${level}`
}

const ASI_LEVELS: Record<ClassName, number[]> = {
  artificer: [4, 8, 12, 16, 19],
  barbarian: [4, 8, 12, 16, 19],
  bard: [4, 8, 12, 16, 19],
  cleric: [4, 8, 12, 16, 19],
  druid: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  monk: [4, 8, 12, 16, 19],
  paladin: [4, 8, 12, 16, 19],
  ranger: [4, 8, 12, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  sorcerer: [4, 8, 12, 16, 19],
  warlock: [4, 8, 12, 16, 19],
  wizard: [4, 8, 12, 16, 19],
}

export function withAbilityScoreImprovements(
  className: ClassName,
  features: LevelFeatureDefinition[],
): LevelFeatureDefinition[] {
  return [
    ...features,
    ...ASI_LEVELS[className].map((level) =>
      feature(level, "Ability Score Improvement", "PHB", {
        choice: {
          id: `asi-${className}-${level}`,
          label: "Ability Score Improvement or feat",
          kind: "asi",
          count: 1,
          allowCustom: true,
        },
      }),
    ),
  ].toSorted((left, right) => left.level - right.level)
}
