import type { CharacterTemplate } from "../characters/CharacterTemplate"
import {
  getClassCastingAttribute,
  getClassKnownSpellLimit,
  getClassKnownSpellsRule,
  getClassSpellcastingProgression,
  getLegacyClassRuleOverrides,
} from "../characters/CharacterProgression"
import type { Attribute } from "./Attribute"

export type SpellcastingProgression = "full" | "half" | "third"

export type KnownSpellMode =
  | "limited"
  | "spellbook"
  | "prepared-only"

export type KnownSpellsRule = {
  baseAtLevel1: number
  perLevel: number
  overrides?: Partial<Record<ClassLevel, number>>
  mode: KnownSpellMode
  canPrepare?: (character: CharacterTemplate) => number
}

export type ClassSourceBook = "PHB" | "Tasha" | "Xanathar"

export type CharacterSubclassSelection = {
  id: string
  name: string
  source: ClassSourceBook
}

export type CharacterClassRuleOverrides = {
  castingAttribute?: Attribute | null
  spellcastingProgression?: SpellcastingProgression | null
  knownSpells?: KnownSpellsRule | null
}

export interface CharacterClassInterface {
  className: ClassName
  level: ClassLevel

  /**
   * Resolved from the class definition unless explicitly overridden.
   * Legacy serialized values remain accepted during migration.
   */
  readonly castingAttribute?: Attribute
  readonly spellcastingProgression?: SpellcastingProgression
  readonly knownSpells?: KnownSpellsRule

  /** Explicit per-character exceptions to the canonical class definition. */
  ruleOverrides?: CharacterClassRuleOverrides

  /** Marks legacy-shaped fields as a derived compatibility snapshot. */
  definitionSnapshot?: true

  /** Selected 2014 subclass, when the class has reached its subclass level. */
  subclass?: CharacterSubclassSelection

  /** Persisted selections made during level-up, keyed by rule/feature id. */
  levelChoices?: Record<string, string[]>
}

export type SerializedKnownSpellsRule = Omit<
  KnownSpellsRule,
  "canPrepare"
> & {
  /** Compatibility marker for consumers not yet using CharacterProgression. */
  canPrepare?: true
}

export type SerializedCharacterClass = Pick<
  CharacterClassInterface,
  "className" | "level" | "subclass" | "levelChoices" | "ruleOverrides"
> & {
  /** Derived compatibility snapshot; never the canonical rule source. */
  definitionSnapshot: true
  castingAttribute?: Attribute
  spellcastingProgression?: SpellcastingProgression
  knownSpells?: SerializedKnownSpellsRule
}

export class CharacterClass implements CharacterClassInterface {
  className: ClassName
  level: ClassLevel
  subclass?: CharacterSubclassSelection
  levelChoices?: Record<string, string[]>
  ruleOverrides?: CharacterClassRuleOverrides

  constructor(
    className: ClassName,
    classLevel: ClassLevel,
    castingAttribute: Attribute | undefined = undefined,
    spellcastingProgression: SpellcastingProgression | undefined = undefined,
    knownSpells: KnownSpellsRule | undefined = undefined,
    subclass: CharacterSubclassSelection | undefined = undefined,
    levelChoices: Record<string, string[]> | undefined = undefined,
    ruleOverrides: CharacterClassRuleOverrides | undefined = undefined,
  ) {
    this.className = className
    this.level = classLevel
    this.subclass = subclass
    this.levelChoices = levelChoices

    const migratedOverrides = getLegacyClassRuleOverrides({
      className,
      level: classLevel,
      castingAttribute,
      spellcastingProgression,
      knownSpells,
      subclass,
      levelChoices,
      ruleOverrides,
    })

    this.ruleOverrides = Object.keys(migratedOverrides).length
      ? migratedOverrides
      : undefined
  }

  static fromJSON(classData: CharacterClassInterface): CharacterClass {
    if (classData instanceof CharacterClass) return classData

    const shouldMigrateLegacyRules = classData.definitionSnapshot !== true

    return new CharacterClass(
      classData.className,
      classData.level,
      shouldMigrateLegacyRules ? classData.castingAttribute : undefined,
      shouldMigrateLegacyRules
        ? classData.spellcastingProgression
        : undefined,
      shouldMigrateLegacyRules ? classData.knownSpells : undefined,
      classData.subclass,
      classData.levelChoices,
      classData.ruleOverrides,
    )
  }

  get castingAttribute(): Attribute | undefined {
    return getClassCastingAttribute(this)
  }

  get spellcastingProgression(): SpellcastingProgression | undefined {
    return getClassSpellcastingProgression(this)
  }

  get knownSpells(): KnownSpellsRule | undefined {
    return getClassKnownSpellsRule(this)
  }

  getKnownSpellLimit(): number | undefined {
    return getClassKnownSpellLimit(this)
  }

  getKnownSpellMode(): KnownSpellMode | undefined {
    return this.knownSpells?.mode
  }

  hasLimitedKnownSpells(): boolean {
    return this.knownSpells?.mode === "limited"
  }

  hasSpellbookKnownSpells(): boolean {
    return this.knownSpells?.mode === "spellbook"
  }

  isPreparedOnlyCaster(): boolean {
    return this.knownSpells?.mode === "prepared-only"
  }

  withLevel(level: ClassLevel): CharacterClass {
    return new CharacterClass(
      this.className,
      level,
      undefined,
      undefined,
      undefined,
      this.subclass,
      this.levelChoices,
      this.ruleOverrides,
    )
  }

  withRuleOverrides(
    patch: Partial<CharacterClassRuleOverrides>,
  ): CharacterClass {
    return new CharacterClass(
      this.className,
      this.level,
      undefined,
      undefined,
      undefined,
      this.subclass,
      this.levelChoices,
      {
        ...(this.ruleOverrides ?? {}),
        ...patch,
      },
    )
  }

  toJSON(): SerializedCharacterClass {
    const knownSpells = this.knownSpells

    return {
      className: this.className,
      level: this.level,
      subclass: this.subclass,
      levelChoices: this.levelChoices,
      ruleOverrides: this.ruleOverrides,
      definitionSnapshot: true,
      castingAttribute: this.castingAttribute,
      spellcastingProgression: this.spellcastingProgression,
      knownSpells: knownSpells
        ? {
            mode: knownSpells.mode,
            baseAtLevel1: knownSpells.baseAtLevel1,
            perLevel: knownSpells.perLevel,
            overrides: knownSpells.overrides,
            canPrepare: knownSpells.canPrepare ? true : undefined,
          }
        : undefined,
    }
  }
}

export class CharacterClassBuilder {
  barbarian() {
    return new CharacterClass("barbarian", 1)
  }

  bard() {
    return new CharacterClass("bard", 1)
  }

  cleric() {
    return new CharacterClass("cleric", 1)
  }

  druid() {
    return new CharacterClass("druid", 1)
  }

  fighter() {
    return new CharacterClass("fighter", 1)
  }

  monk() {
    return new CharacterClass("monk", 1)
  }

  paladin() {
    return new CharacterClass("paladin", 1)
  }

  ranger() {
    return new CharacterClass("ranger", 1)
  }

  rogue() {
    return new CharacterClass("rogue", 1)
  }

  sorcerer() {
    return new CharacterClass("sorcerer", 1)
  }

  warlock() {
    return new CharacterClass("warlock", 1)
  }

  wizard() {
    return new CharacterClass("wizard", 1)
  }

  artificer() {
    return new CharacterClass("artificer", 1)
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
