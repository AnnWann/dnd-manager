import { getCantripsKnownAtLevel } from "../../data/classProgression"
import {
  CUSTOM_CLASS_RUNTIME_ID,
  createCustomClassEntry,
  getCustomClassConfigFromEntry,
  isCustomClassEntry,
} from "../characters/customClassConfig"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Spell } from "../magic/spells/Spell"
import { deriveLeveledSlotsFromClasses } from "../magic/spells/SpellSlotProgression"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import type { Attribute } from "../sheet/Attribute"
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
  castingAttribute?: Attribute
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
 * Structural spell progression. Prepared casters keep mode="prepared" so their
 * cantrip progression can be selected without treating prepared leveled spells
 * as learned spells. Custom classes read their rule from the character entry
 * instead of borrowing one of the official class chassis.
 */
export function getClassSpellSelectionRule(
  character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  const level = clampLevel(classLevel)

  if (String(className) === String(CUSTOM_CLASS_RUNTIME_ID)) {
    return getCustomSpellSelectionRule(character, level, subclassId)
  }

  const classEntry = createClassEntry(className, level)
  const baseMode = getBaseMode(className)
  const maxSpellLevel = getMaximumSpellLevel(className, level)
  const maxCantrips = getCantripsKnownAtLevel(className, level)
  const maxLeveledSpells = getLeveledSpellLimit(classEntry, level)
  const mode =
    baseMode !== "none" && maxSpellLevel === 0 && maxCantrips === 0
      ? "none"
      : baseMode

  return {
    className,
    classLevel: level,
    subclassId,
    mode,
    castingAttribute: classEntry.castingAttribute,
    maxSpellLevel,
    maxCantrips,
    maxLeveledSpells,
    swap: {
      leveledKnown: getSpellReplacementLimit(className, level),
      cantrips: 0,
    },
  }
}

function getCustomSpellSelectionRule(
  character: CharacterTemplate,
  level: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  const stored = (character.get("sheet").classes ?? []).find(isCustomClassEntry)
  const baseEntry = stored ?? createCustomClassEntry()
  const entry: CharacterClassInterface = {
    ...baseEntry,
    level: level as ClassLevel,
  }
  const config = getCustomClassConfigFromEntry(entry)

  if (!config || config.casterType === "none") {
    return {
      className: CUSTOM_CLASS_RUNTIME_ID,
      classLevel: level,
      subclassId,
      mode: "none",
      maxSpellLevel: 0,
      maxCantrips: 0,
      maxLeveledSpells: 0,
      swap: { leveledKnown: 0, cantrips: 0 },
    }
  }

  const slots = deriveLeveledSlotsFromClasses([entry])
  const maxSpellLevel = Math.max(
    0,
    ...Object.entries(slots)
      .filter(([, slot]) => (slot?.max ?? 0) > 0)
      .map(([circle]) => Number(circle)),
  ) as MagicCircleLevel
  const mode: SpellSelectionMode =
    config.knownSpellMode === "spellbook"
      ? "spellbook"
      : config.knownSpellMode === "prepared-only"
        ? "prepared"
        : "limited-known"
  const maxLeveledSpells =
    config.knownSpellMode === "prepared-only"
      ? 0
      : Math.max(
          0,
          Math.floor(
            config.knownAtLevel1 +
              Math.max(0, level - 1) * config.knownPerLevel,
          ),
        )

  return {
    className: CUSTOM_CLASS_RUNTIME_ID,
    classLevel: level,
    subclassId,
    mode: maxSpellLevel === 0 ? "none" : mode,
    castingAttribute: config.castingAttribute,
    maxSpellLevel,
    maxCantrips: 0,
    maxLeveledSpells,
    swap: { leveledKnown: 0, cantrips: 0 },
  }
}

export function getSpellReplacementLimit(
  className: ClassName,
  classLevel: number,
): number {
  if (classLevel <= 1) return 0
  return ["bard", "ranger", "sorcerer", "warlock"].includes(className)
    ? 1
    : 0
}

export function getSubclassSpellGrants(
  _className: ClassName,
  _subclassId: string | undefined,
  _classLevel: number,
): SubclassSpellGrant[] {
  return []
}

export function isSpellAllowedForClassSelection(
  spell: Spell,
  rule: ClassSpellSelectionRule,
  _subclassSpellNames: string[],
): boolean {
  if (rule.mode === "none") return false
  if (
    String(rule.className) !== String(CUSTOM_CLASS_RUNTIME_ID) &&
    !spell.classes.includes(rule.className)
  ) {
    return false
  }

  if (spell.slotLevel === 0) return rule.maxCantrips > 0
  if (rule.mode === "prepared") return false
  return spell.slotLevel <= rule.maxSpellLevel
}

export function getMetamagicLimit(sorcererLevel: number): number {
  const level = clampLevel(sorcererLevel)
  if (level < 3) return 0
  if (level >= 17) return 4
  if (level >= 10) return 3
  return 2
}

export function canReplaceMetamagicAtLevel(sorcererLevel: number): boolean {
  return [4, 8, 12, 16, 19].includes(clampLevel(sorcererLevel))
}

export function getSubclassOptions(_className: ClassName): [] {
  return []
}

export function createClassEntry(
  className: ClassName,
  level: number,
): CharacterClassInterface {
  const normalizedLevel = clampLevel(level) as ClassLevel
  if (String(className) === String(CUSTOM_CLASS_RUNTIME_ID)) {
    return {
      ...createCustomClassEntry(),
      level: normalizedLevel,
    }
  }

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
    level: normalizedLevel,
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
  classEntry: CharacterClassInterface,
  level: number,
): number {
  if (classEntry.knownSpells?.mode === "limited") {
    return LIMITED_KNOWN[classEntry.className]?.[level] ?? 0
  }
  if (classEntry.knownSpells?.mode === "spellbook") {
    return 6 + Math.max(0, level - 1) * 2
  }
  return 0
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
