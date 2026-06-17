import type { CharacterTemplate } from "../characters/CharacterTemplate"
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

export interface CharacterClassInterface {
  className: ClassName
  level: ClassLevel
  castingAttribute?: Attribute

  /** Optional: override for multiclass spell slot progression. */
  spellcastingProgression?: SpellcastingProgression

  knownSpells?: KnownSpellsRule
}

export class CharacterClass implements CharacterClassInterface {
  className: ClassName
  level: ClassLevel
  castingAttribute?: Attribute
  spellcastingProgression?: SpellcastingProgression
  knownSpells?: KnownSpellsRule

  constructor(
    className: ClassName,
    classLevel: ClassLevel,
    castingAttribute: Attribute | undefined = undefined,
    spellcastingProgression: SpellcastingProgression | undefined = undefined,
    knownSpells: KnownSpellsRule | undefined = undefined,
  ) {
    this.className = className
    this.level = classLevel
    this.castingAttribute = castingAttribute
    this.spellcastingProgression = spellcastingProgression
    this.knownSpells = knownSpells
  }

  getKnownSpellLimit(): number | undefined {
    if (!this.knownSpells) return undefined

    const override = this.knownSpells.overrides?.[this.level]
    if (override !== undefined) return override

    return (
      this.knownSpells.baseAtLevel1 +
      Math.max(0, this.level - 1) * this.knownSpells.perLevel
    )
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
}

const BARD_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 4,
  perLevel: 1,
  overrides: {
    10: 14,
    11: 15,
    12: 15,
    13: 16,
    14: 18,
    15: 19,
    16: 19,
    17: 20,
    18: 22,
    19: 22,
    20: 22,
  },
}

const SORCERER_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 2,
  perLevel: 1,
  overrides: {
    12: 12,
    14: 13,
    16: 14,
    18: 15,
    19: 15,
    20: 15,
  },
}

const WARLOCK_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 2,
  perLevel: 1,
  overrides: {
    10: 10,
    12: 11,
    14: 12,
    16: 13,
    18: 14,
    20: 15,
  },
}

const RANGER_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 0,
  perLevel: 1,
  overrides: {
    1: 0,
    2: 2,
    3: 3,
    4: 3,
    5: 4,
    6: 4,
    7: 5,
    8: 5,
    9: 6,
    10: 6,
    11: 7,
    12: 7,
    13: 8,
    14: 8,
    15: 9,
    16: 9,
    17: 10,
    18: 10,
    19: 11,
    20: 11,
  },
}

const WIZARD_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "spellbook",
  baseAtLevel1: 6,
  perLevel: 2,
}

const PREPARED_ONLY_SPELLS: KnownSpellsRule = {
  mode: "prepared-only",
  baseAtLevel1: 0,
  perLevel: 0,
}

function minimumOne(value: number): number {
  return Math.max(1, value)
}

const ARTIFICER_PREPARED_SPELLS: KnownSpellsRule = {
  ...PREPARED_ONLY_SPELLS,
  canPrepare: (character) =>
    minimumOne(
      Math.floor(character.getClassLevel("artificer") / 2) +
        character.getAttributeModifier('int'),
    ),
}

const CLERIC_PREPARED_SPELLS: KnownSpellsRule = {
  ...PREPARED_ONLY_SPELLS,
  canPrepare: (character) =>
    minimumOne(
      character.getClassLevel("cleric") +
        character.getAttributeModifier("wis")
    ),
}

const DRUID_PREPARED_SPELLS: KnownSpellsRule = {
  ...PREPARED_ONLY_SPELLS,
  canPrepare: (character) =>
    minimumOne(
     character.getClassLevel("druid") +
        character.getAttributeModifier("wis")
    ),
}

const PALADIN_PREPARED_SPELLS: KnownSpellsRule = {
  ...PREPARED_ONLY_SPELLS,
  canPrepare: (character) =>
    minimumOne(
      Math.floor(character.getClassLevel("paladin") / 2) +
        character.getAttributeModifier("cha"),
    ),
}

const WIZARD_PREPARED_SPELLS: KnownSpellsRule = {
  ...WIZARD_KNOWN_SPELLS,
  canPrepare: (character) =>
    minimumOne(
      character.getClassLevel("wizard") +
        character.getAttributeModifier("int"),
    ),
}

export class CharacterClassBuilder {
  barbarian() {
    return new CharacterClass("barbarian", 1)
  }

  bard() {
    return new CharacterClass(
      "bard",
      1,
      "cha",
      "full",
      BARD_KNOWN_SPELLS,
    )
  }

  cleric() {
    return new CharacterClass(
      "cleric",
      1,
      "wis",
      "full",
      CLERIC_PREPARED_SPELLS,
    )
  }

  druid() {
    return new CharacterClass(
      "druid",
      1,
      "wis",
      "full",
      DRUID_PREPARED_SPELLS,
    )
  }

  fighter() {
    return new CharacterClass("fighter", 1)
  }

  monk() {
    return new CharacterClass("monk", 1)
  }

  paladin() {
    return new CharacterClass(
      "paladin",
      1,
      "cha",
      "half",
      PALADIN_PREPARED_SPELLS,
    )
  }

  ranger() {
    return new CharacterClass(
      "ranger",
      1,
      "wis",
      "half",
      RANGER_KNOWN_SPELLS,
    )
  }

  rogue() {
    return new CharacterClass("rogue", 1)
  }

  sorcerer() {
    return new CharacterClass(
      "sorcerer",
      1,
      "cha",
      "full",
      SORCERER_KNOWN_SPELLS,
    )
  }

  warlock() {
    return new CharacterClass(
      "warlock",
      1,
      "cha",
      "full",
      WARLOCK_KNOWN_SPELLS,
    )
  }

  wizard() {
    return new CharacterClass(
      "wizard",
      1,
      "int",
      "full",
      WIZARD_PREPARED_SPELLS,
    )
  }

  artificer() {
    return new CharacterClass(
      "artificer",
      1,
      "int",
      "half",
      ARTIFICER_PREPARED_SPELLS,
    )
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