import type { ProgressionAbilityConfig } from "../../models/leveling/ProgressionAbilityConfig"
import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
  SubclassDefinition,
} from "./catalog/ClassProgression"

export type ProgressionMergeMode = "extend" | "replace"

/**
 * LevelFeatureDefinition with an optional complete Ability template.
 *
 * Existing progression features remain valid because `ability` is optional.
 */
export type ConfiguredLevelFeatureDefinition = LevelFeatureDefinition & {
  ability?: ProgressionAbilityConfig
}

/**
 * One subclass module. Each concrete subclass can live in its own nested folder
 * and be collected by the class-level `subclasses/index.ts` file.
 */
export type SubclassProgressionModule<
  TClassName extends ClassName = ClassName,
> = Omit<SubclassDefinition, "className" | "features"> & {
  className: TClassName
  features: ConfiguredLevelFeatureDefinition[]
  mergeMode?: ProgressionMergeMode
}

/**
 * Incremental module for one class. Omitted properties keep their current
 * values, while `replace` makes the module authoritative for that section.
 */
export type ClassProgressionModule<
  TClassName extends ClassName = ClassName,
> = {
  className: TClassName
  definition?: Partial<
    Pick<
      ClassProgressionDefinition,
      "label" | "hitDie" | "source" | "subclassLevel" | "cantripsKnown"
    >
  >
  features?: ConfiguredLevelFeatureDefinition[]
  featureMergeMode?: ProgressionMergeMode
  subclasses?: SubclassProgressionModule<TClassName>[]
  subclassMergeMode?: ProgressionMergeMode
}
