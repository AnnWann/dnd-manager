import { getCantripsKnownAtLevel } from "../../data/classProgression"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Spell } from "../magic/spells/Spell"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type ClassLevel,
  type ClassName,
} from "../sheet/Class"

export type SpellSelectionMode =
  | "none"
  | "limited-known"
  | "spellbook"
  | "prepared"

export type SpellSwapRule = {
  leveledKnown: number
  cantrips: number
  onlyAtAsiLevel?: boolean
}

export type ClassSpellSelectionRule = {
  className: ClassName
  classLevel: number
  subclassId?: string
  mode: SpellSelectionMode
  castingAttribute?: "int" | "wis" | "cha"
  maxSpellLevel: MagicCircleLevel
  maxCantrips: number
  maxLeveledSpells: number
  swap: SpellSwapRule
  allowedSchools?: string[]
  unrestrictedLeveledSpellCount?: number
  additionalClassLists?: ClassName[]
  dynamicAutomaticSpellNames?: string[]
  dynamicExpandedSpellNames?: string[]
}

export type SubclassSpellGrantMode =
  | "expanded-list"
  | "always-prepared"
  | "bonus-known"

export type SubclassSpellGrant = {
  className: ClassName
  subclassId: string
  classLevel: number
  spellNames: string[]
  mode: SubclassSpellGrantMode
}

const LIMITED_KNOWN: Partial<Record<ClassName, Record<number, number>>> = {
  bard: levelTable([
    4, 5, 6, 7, 8, 9, 10, 11, 12, 14,
    15, 15, 16, 18, 19, 19, 20, 22, 22, 22,
  ]),
  sorcerer: levelTable([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 12, 13, 13, 14, 14, 15, 15, 15, 15,
  ]),
  warlock: levelTable([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 10,
    11, 11, 12, 12, 13, 13, 14, 14, 15, 15,
  ]),
  ranger: levelTable([
    0, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
  ]),
}

/**
 * Only structural caster progression is encoded here: selection counts,
 * preparation counts and maximum spell level. Spell names, subclass grants and
 * legal class spell lists are deliberately not bundled.
 */
export function getClassSpellSelectionRule(
  character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  const level = clampLevel(classLevel)
  const classEntry = createClassEntry(className, level)
  const baseMode = getBaseMode(className)
  const maxSpellLevel = getMaximumSpellLevel(className, level)
  const maxCantrips = getCantripsKnownAtLevel(className, level)
  const maxLeveledSpells = getLeveledSpellLimit(character, classEntry, level)
  const mode =
    baseMode !== "none" && maxSpellLevel === 0 && maxCantrips === 0
      ? "none"
      : baseMode

  return {
    className,
    classLevel: level,
    subclassId,
    mode,
    castingAttribute: classEntry.castingAttribute as
      | "int"
      | "wis"
      | "cha"
      | undefined,
    maxSpellLevel,
    maxCantrips,
    maxLeveledSpells,
    swap: { leveledKnown: 0, cantrips: 0 },
  }
}

export function getSubclassSpellGrants(
  _className: ClassName,
  _subclassId: string | undefined,
  _classLevel: number,
): SubclassSpellGrant[] {
  return []
}

/**
 * The creator exposes the loaded compendium and limits only by spell level and
 * the class's cantrip capacity. The user checks the legal spell list in their
 * own reference.
 */
export function isSpellAllowedForClassSelection(
  spell: Spell,
  rule: ClassSpellSelectionRule,
  _subclassSpellNames: string[],
): boolean {
  if (rule.mode === "none") return false
  if (spell.slotLevel > rule.maxSpellLevel) return false
  if (spell.slotLevel === 0 && rule.maxCantrips <= 0) return false
  return true
}

/** Public structural progression only; metamagic option content remains separate. */
export function getMetamagicLimit(sorcererLevel: number): number {
  const level = clampLevel(sorcererLevel)
  if (level < 3) return 0
  if (level >= 17) return 4
  if (level >= 10) return 3
  return 2
}

export function canReplaceMetamagicAtLevel(_sorcererLevel: number): boolean {
  return false
}

export function getSubclassOptions(_className: ClassName): [] {
  return []
}

export function createClassEntry(
  className: ClassName,
  level: number,
): CharacterClassInterface {
  const builder = new CharacterClassBuilder()
  let entry: CharacterClassInterface

  switch (className) {
    case "artificer": entry = builder.artificer(); break
    case "barbarian": entry = builder.barbarian(); break
    case "bard": entry = builder.bard(); break
    case "cleric": entry = builder.cleric(); break
    case "druid": entry = builder.druid(); break
    case "fighter": entry = builder.fighter(); break
    case "monk": entry = builder.monk(); break
    case "paladin": entry = builder.paladin(); break
    case "ranger": entry = builder.ranger(); break
    case "rogue": entry = builder.rogue(); break
    case "sorcerer": entry = builder.sorcerer(); break
    case "warlock": entry = builder.warlock(); break
    case "wizard": entry = builder.wizard(); break
  }

  return {
    ...entry,
    level: clampLevel(level) as ClassLevel,
  }
}

export function normalizeSpellName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function getBaseMode(className: ClassName): SpellSelectionMode {
  if (["bard", "ranger", "sorcerer", "warlock"].includes(className)) {
    return "limited-known"
  }
  if (className === "wizard") return "spellbook"
  if (["artificer", "cleric", "druid", "paladin"].includes(className)) {
    return "prepared"
  }
  return "none"
}

function getLeveledSpellLimit(
  character: CharacterTemplate,
  classEntry: CharacterClassInterface,
  level: number,
): number {
  if (classEntry.knownSpells?.mode === "limited") {
    return LIMITED_KNOWN[classEntry.className]?.[level] ?? 0
  }
  if (classEntry.knownSpells?.mode === "spellbook") {
    return 6 + Math.max(0, level - 1) * 2
  }
  if (classEntry.knownSpells?.mode === "prepared-only") {
    return getPreparedSpellLimit(character, classEntry.className, level)
  }
  return 0
}

function getPreparedSpellLimit(
  character: CharacterTemplate,
  className: ClassName,
  level: number,
): number {
  switch (className) {
    case "artificer":
      return Math.max(
        1,
        Math.floor(level / 2) + character.getAttributeModifier("int"),
      )
    case "cleric":
    case "druid":
      return Math.max(
        1,
        level + character.getAttributeModifier("wis"),
      )
    case "paladin":
      return Math.max(
        1,
        Math.floor(level / 2) + character.getAttributeModifier("cha"),
      )
    case "wizard":
      return Math.max(
        1,
        level + character.getAttributeModifier("int"),
      )
    default:
      return 0
  }
}

function getMaximumSpellLevel(
  className: ClassName,
  level: number,
): MagicCircleLevel {
  if (className === "warlock") {
    return Math.min(5, Math.ceil(level / 2)) as MagicCircleLevel
  }
  if (
    ["bard", "cleric", "druid", "sorcerer", "wizard"].includes(className)
  ) {
    return Math.min(9, Math.ceil(level / 2)) as MagicCircleLevel
  }
  if (className === "artificer") {
    return Math.min(5, Math.ceil(level / 4)) as MagicCircleLevel
  }
  if (["paladin", "ranger"].includes(className)) {
    return (level < 2
      ? 0
      : Math.min(5, Math.ceil(level / 4))) as MagicCircleLevel
  }
  return 0
}

function clampLevel(value: number): number {
  return Math.max(1, Math.min(20, Math.trunc(value || 1)))
}

function levelTable(values: number[]): Record<number, number> {
  return Object.fromEntries(values.map((value, index) => [index + 1, value]))
}
