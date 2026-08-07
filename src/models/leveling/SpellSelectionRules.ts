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

/**
 * Progression never infers the legal spell list or limits. Caster classes get a
 * deliberately unrestricted manual picker; the user consults their own rules
 * reference and chooses only the spells they are entitled to.
 */
export function getClassSpellSelectionRule(
  _character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  const classEntry = createClassEntry(className, classLevel)
  const isCaster = Boolean(classEntry.castingAttribute)

  return {
    className,
    classLevel: clampLevel(classLevel),
    subclassId,
    mode: isCaster ? "prepared" : "none",
    castingAttribute: classEntry.castingAttribute as
      | "int"
      | "wis"
      | "cha"
      | undefined,
    maxSpellLevel: isCaster ? 9 : 0,
    maxCantrips: isCaster ? 99 : 0,
    maxLeveledSpells: isCaster ? 99 : 0,
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

/** Manual spell selection intentionally exposes the whole loaded compendium. */
export function isSpellAllowedForClassSelection(
  _spell: Spell,
  rule: ClassSpellSelectionRule,
  _subclassSpellNames: string[],
): boolean {
  return rule.mode !== "none"
}

export function getMetamagicLimit(_sorcererLevel: number): number {
  return 0
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

function clampLevel(value: number): number {
  return Math.max(1, Math.min(20, Math.trunc(value || 1)))
}
