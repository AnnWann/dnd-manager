import type { DieSides } from "../../models/dice/Die"
import type { ClassName, ClassSourceBook } from "../../models/sheet/Class"
import type { ProgressionAbilityConfig } from "./ability"

export type LevelChoiceKind =
  | "fighting-style"
  | "expertise"
  | "metamagic"
  | "pact-boon"
  | "invocation"
  | "maneuver"
  | "infusion"
  | "elemental-discipline"
  | "rune"
  | "subclass-option"
  | "asi"
  | "optional-feature"
  | "custom"

export type LevelChoiceDefinition = {
  id: string
  label: string
  kind: LevelChoiceKind
  count: number
  options?: string[]
  allowCustom?: boolean
  description?: string
}

export type LevelFeatureDefinition = {
  id: string
  name: string
  level: number
  source: ClassSourceBook
  optional?: boolean
  description?: string
  choice?: LevelChoiceDefinition
  ability?: ProgressionAbilityConfig
}

export type SubclassDefinition<
  TClassName extends ClassName = ClassName,
> = {
  id: string
  name: string
  className: TClassName
  source: ClassSourceBook
  features: LevelFeatureDefinition[]
}

export type ClassProgressionDefinition<
  TClassName extends ClassName = ClassName,
> = {
  className: TClassName
  label: string
  hitDie: DieSides
  source: ClassSourceBook
  subclassLevel: number
  features: LevelFeatureDefinition[]
  subclasses: SubclassDefinition<TClassName>[]
  cantripsKnown?: Partial<Record<number, number>>
}

export type ConfiguredLevelFeatureDefinition = LevelFeatureDefinition
export type SubclassProgressionModule<
  TClassName extends ClassName = ClassName,
> = SubclassDefinition<TClassName>
export type ClassProgressionModule<
  TClassName extends ClassName = ClassName,
> = ClassProgressionDefinition<TClassName>
