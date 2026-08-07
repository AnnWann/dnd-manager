import type { Attribute } from "./Attribute"

export type SpellcastingProgression = "full" | "half" | "third"

export type ClassSourceBook = string

export type CharacterSubclassSelection = {
  id: string
  name: string
  source: ClassSourceBook
}

export interface CharacterClassInterface {
  className: ClassName
  level: ClassLevel
  castingAttribute?: Attribute

  /** Optional: override for multiclass spell slot progression. */
  spellcastingProgression?: SpellcastingProgression

  /** User-entered subclass. */
  subclass?: CharacterSubclassSelection

  /** Persisted user-entered choices, keyed by an arbitrary id. */
  levelChoices?: Record<string, string[]>
}

export class CharacterClass implements CharacterClassInterface {
  className: ClassName
  level: ClassLevel
  castingAttribute?: Attribute
  spellcastingProgression?: SpellcastingProgression
  subclass?: CharacterSubclassSelection
  levelChoices?: Record<string, string[]>

  constructor(
    className: ClassName,
    classLevel: ClassLevel,
    castingAttribute: Attribute | undefined = undefined,
    spellcastingProgression: SpellcastingProgression | undefined = undefined,
    subclass: CharacterSubclassSelection | undefined = undefined,
    levelChoices: Record<string, string[]> | undefined = undefined,
  ) {
    this.className = className
    this.level = classLevel
    this.castingAttribute = castingAttribute
    this.spellcastingProgression = spellcastingProgression
    this.subclass = subclass
    this.levelChoices = levelChoices
  }
}

export class CharacterClassBuilder {
  barbarian() {
    return new CharacterClass("barbarian", 1)
  }

  bard() {
    return new CharacterClass("bard", 1, "cha", "full")
  }

  cleric() {
    return new CharacterClass("cleric", 1, "wis", "full")
  }

  druid() {
    return new CharacterClass("druid", 1, "wis", "full")
  }

  fighter() {
    return new CharacterClass("fighter", 1)
  }

  monk() {
    return new CharacterClass("monk", 1)
  }

  paladin() {
    return new CharacterClass("paladin", 1, "cha", "half")
  }

  ranger() {
    return new CharacterClass("ranger", 1, "wis", "half")
  }

  rogue() {
    return new CharacterClass("rogue", 1)
  }

  sorcerer() {
    return new CharacterClass("sorcerer", 1, "cha", "full")
  }

  warlock() {
    return new CharacterClass("warlock", 1, "cha", "full")
  }

  wizard() {
    return new CharacterClass("wizard", 1, "int", "full")
  }

  artificer() {
    return new CharacterClass("artificer", 1, "int", "half")
  }
}

export type ClassName =
  | "artificer"
  | "barbarian"
  | "bard"
  | "cleric"
  | "druid"
  | "fighter"
  | "monk"
  | "paladin"
  | "ranger"
  | "rogue"
  | "sorcerer"
  | "warlock"
  | "wizard"

export type ClassLevel =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
