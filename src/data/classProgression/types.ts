import type { DieSides } from "../../models/dice/Die"
import type { ClassName, ClassSourceBook } from "../../models/sheet/Class"

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

/** Generic shape retained for user-authored/imported feature data. */
export type LevelFeatureDefinition = {
  id: string
  name: string
  level: number
  source: ClassSourceBook
  optional?: boolean
  description?: string
  choice?: LevelChoiceDefinition
}

/** Generic shape retained for user-authored/imported subclass data. */
export type SubclassDefinition<TClassName extends ClassName = ClassName> = {
  id: string
  name: string
  className: TClassName
  source: ClassSourceBook
  features: LevelFeatureDefinition[]
}

/**
 * Minimal class metadata used by the sheet. Bundled progression content is
 * intentionally empty; users configure subclasses and features themselves.
 */
export type ClassProgressionDefinition<TClassName extends ClassName = ClassName> = {
  className: TClassName
  label: string
  hitDie: DieSides
  source: ClassSourceBook
  subclassLevel: number
  features: LevelFeatureDefinition[]
  subclasses: SubclassDefinition<TClassName>[]
  cantripsKnown?: Partial<Record<number, number>>
}
