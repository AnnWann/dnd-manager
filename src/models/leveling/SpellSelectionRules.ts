import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Spell } from "../magic/spells/Spell"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type ClassLevel,
  type ClassName,
} from "../sheet/Class"
import {
  getDynamicSubclassSpellGrants,
} from "./DynamicSubclassSpellRules"
import {
  getExpandedCantripsKnownAtLevel,
  getExpandedClassProgression,
} from "./ExpandedClassProgression"

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

type SpellGrantEntry = [number, ...string[]]

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

const THIRD_CASTER_KNOWN = levelTable([
  0, 0, 3, 4, 4, 4, 5, 6, 6, 7,
  8, 8, 9, 10, 10, 11, 11, 11, 12, 13,
])

const FALLBACK_CANTRIPS: Partial<Record<ClassName, Record<number, number>>> = {
  artificer: thresholdTable([[1, 2], [10, 3], [14, 4]]),
  bard: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  cleric: thresholdTable([[1, 3], [4, 4], [10, 5]]),
  druid: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  sorcerer: thresholdTable([[1, 4], [4, 5], [10, 6]]),
  warlock: thresholdTable([[1, 2], [4, 3], [10, 4]]),
  wizard: thresholdTable([[1, 3], [4, 4], [10, 5]]),
}

const ASI_LEVELS = [4, 8, 12, 16, 19]
const CANTRIP_VERSATILITY_CLASSES: ClassName[] = [
  "artificer",
  "bard",
  "cleric",
  "druid",
  "sorcerer",
  "warlock",
]

const SUBCLASS_SPELL_GRANTS: SubclassSpellGrant[] = [
  ...domain("knowledge", [
    [1, "Command", "Identify"], [3, "Augury", "Suggestion"],
    [5, "Nondetection", "Speak with Dead"], [7, "Arcane Eye", "Confusion"],
    [9, "Legend Lore", "Scrying"],
  ]),
  ...domain("life", [
    [1, "Bless", "Cure Wounds"], [3, "Lesser Restoration", "Spiritual Weapon"],
    [5, "Beacon of Hope", "Revivify"], [7, "Death Ward", "Guardian of Faith"],
    [9, "Mass Cure Wounds", "Raise Dead"],
  ]),
  ...domain("light", [
    [1, "Burning Hands", "Faerie Fire"], [3, "Flaming Sphere", "Scorching Ray"],
    [5, "Daylight", "Fireball"], [7, "Guardian of Faith", "Wall of Fire"],
    [9, "Flame Strike", "Scrying"],
  ]),
  ...domain("nature", [
    [1, "Animal Friendship", "Speak with Animals"], [3, "Barkskin", "Spike Growth"],
    [5, "Plant Growth", "Wind Wall"], [7, "Dominate Beast", "Grasping Vine"],
    [9, "Insect Plague", "Tree Stride"],
  ]),
  ...domain("tempest", [
    [1, "Fog Cloud", "Thunderwave"], [3, "Gust of Wind", "Shatter"],
    [5, "Call Lightning", "Sleet Storm"], [7, "Control Water", "Ice Storm"],
    [9, "Destructive Wave", "Insect Plague"],
  ]),
  ...domain("trickery", [
    [1, "Charm Person", "Disguise Self"], [3, "Mirror Image", "Pass without Trace"],
    [5, "Blink", "Dispel Magic"], [7, "Dimension Door", "Polymorph"],
    [9, "Dominate Person", "Modify Memory"],
  ]),
  ...domain("war", [
    [1, "Divine Favor", "Shield of Faith"], [3, "Magic Weapon", "Spiritual Weapon"],
    [5, "Crusader's Mantle", "Spirit Guardians"], [7, "Freedom of Movement", "Stoneskin"],
    [9, "Flame Strike", "Hold Monster"],
  ]),
  ...domain("forge", [
    [1, "Identify", "Searing Smite"], [3, "Heat Metal", "Magic Weapon"],
    [5, "Elemental Weapon", "Protection from Energy"], [7, "Fabricate", "Wall of Fire"],
    [9, "Animate Objects", "Creation"],
  ]),
  ...domain("grave", [
    [1, "Bane", "False Life"], [3, "Gentle Repose", "Ray of Enfeeblement"],
    [5, "Revivify", "Vampiric Touch"], [7, "Blight", "Death Ward"],
    [9, "Antilife Shell", "Raise Dead"],
  ]),
  ...domain("order", [
    [1, "Command", "Heroism"], [3, "Hold Person", "Zone of Truth"],
    [5, "Mass Healing Word", "Slow"], [7, "Compulsion", "Locate Creature"],
    [9, "Commune", "Dominate Person"],
  ]),
  ...domain("peace", [
    [1, "Heroism", "Sanctuary"], [3, "Aid", "Warding Bond"],
    [5, "Beacon of Hope", "Sending"], [7, "Aura of Purity", "Otiluke's Resilient Sphere"],
    [9, "Greater Restoration", "Rary's Telepathic Bond"],
  ]),
  ...domain("twilight", [
    [1, "Faerie Fire", "Sleep"], [3, "Moonbeam", "See Invisibility"],
    [5, "Aura of Vitality", "Leomund's Tiny Hut"], [7, "Aura of Life", "Greater Invisibility"],
    [9, "Circle of Power", "Mislead"],
  ]),

  ...oath("devotion", [
    [3, "Protection from Evil and Good", "Sanctuary"], [5, "Lesser Restoration", "Zone of Truth"],
    [9, "Beacon of Hope", "Dispel Magic"], [13, "Freedom of Movement", "Guardian of Faith"],
    [17, "Commune", "Flame Strike"],
  ]),
  ...oath("ancients", [
    [3, "Ensnaring Strike", "Speak with Animals"], [5, "Moonbeam", "Misty Step"],
    [9, "Plant Growth", "Protection from Energy"], [13, "Ice Storm", "Stoneskin"],
    [17, "Commune with Nature", "Tree Stride"],
  ]),
  ...oath("vengeance", [
    [3, "Bane", "Hunter's Mark"], [5, "Hold Person", "Misty Step"],
    [9, "Haste", "Protection from Energy"], [13, "Banishment", "Dimension Door"],
    [17, "Hold Monster", "Scrying"],
  ]),
  ...oath("conquest", [
    [3, "Armor of Agathys", "Command"], [5, "Hold Person", "Spiritual Weapon"],
    [9, "Bestow Curse", "Fear"], [13, "Dominate Beast", "Stoneskin"],
    [17, "Cloudkill", "Dominate Person"],
  ]),
  ...oath("redemption", [
    [3, "Sanctuary", "Sleep"], [5, "Calm Emotions", "Hold Person"],
    [9, "Counterspell", "Hypnotic Pattern"], [13, "Otiluke's Resilient Sphere", "Stoneskin"],
    [17, "Hold Monster", "Wall of Force"],
  ]),
  ...oath("glory", [
    [3, "Guiding Bolt", "Heroism"], [5, "Enhance Ability", "Magic Weapon"],
    [9, "Haste", "Protection from Energy"], [13, "Compulsion", "Freedom of Movement"],
    [17, "Commune", "Flame Strike"],
  ]),
  ...oath("watchers", [
    [3, "Alarm", "Detect Magic"], [5, "Moonbeam", "See Invisibility"],
    [9, "Counterspell", "Nondetection"], [13, "Aura of Purity", "Banishment"],
    [17, "Hold Monster", "Scrying"],
  ]),

  ...patron("archfey", [
    [1, "Faerie Fire", "Sleep"], [3, "Calm Emotions", "Phantasmal Force"],
    [5, "Blink", "Plant Growth"], [7, "Dominate Beast", "Greater Invisibility"],
    [9, "Dominate Person", "Seeming"],
  ]),
  ...patron("fiend", [
    [1, "Burning Hands", "Command"], [3, "Blindness/Deafness", "Scorching Ray"],
    [5, "Fireball", "Stinking Cloud"], [7, "Fire Shield", "Wall of Fire"],
    [9, "Flame Strike", "Hallow"],
  ]),
  ...patron("great-old-one", [
    [1, "Dissonant Whispers", "Tasha's Hideous Laughter"],
    [3, "Detect Thoughts", "Phantasmal Force"], [5, "Clairvoyance", "Sending"],
    [7, "Dominate Beast", "Evard's Black Tentacles"], [9, "Dominate Person", "Telekinesis"],
  ]),
  ...patron("celestial", [
    [1, "Cure Wounds", "Guiding Bolt"], [3, "Flaming Sphere", "Lesser Restoration"],
    [5, "Daylight", "Revivify"], [7, "Guardian of Faith", "Wall of Fire"],
    [9, "Flame Strike", "Greater Restoration"],
  ]),
  ...patron("hexblade", [
    [1, "Shield", "Wrathful Smite"], [3, "Blur", "Branding Smite"],
    [5, "Blink", "Elemental Weapon"], [7, "Phantasmal Killer", "Staggering Smite"],
    [9, "Banishing Smite", "Cone of Cold"],
  ]),
  ...patron("fathomless", [
    [1, "Create or Destroy Water", "Thunderwave"], [3, "Gust of Wind", "Silence"],
    [5, "Lightning Bolt", "Sleet Storm"], [7, "Control Water", "Summon Elemental"],
    [9, "Bigby's Hand", "Cone of Cold"],
  ]),
  ...patron("genie", [
    [1, "Detect Evil and Good"], [3, "Phantasmal Force"],
    [5, "Create Food and Water"], [7, "Phantasmal Killer"],
    [9, "Creation"], [17, "Wish"],
  ]),
  ...bonusKnown("warlock", "celestial", [[1, "Light", "Sacred Flame"]]),

  ...bonusKnown("sorcerer", "aberrant-mind", [
    [1, "Arms of Hadar", "Dissonant Whispers"], [3, "Calm Emotions", "Detect Thoughts"],
    [5, "Hunger of Hadar", "Sending"], [7, "Evard's Black Tentacles", "Summon Aberration"],
    [9, "Rary's Telepathic Bond", "Telekinesis"],
  ]),
  ...bonusKnown("sorcerer", "clockwork-soul", [
    [1, "Alarm", "Protection from Evil and Good"], [3, "Aid", "Lesser Restoration"],
    [5, "Dispel Magic", "Protection from Energy"], [7, "Freedom of Movement", "Summon Construct"],
    [9, "Greater Restoration", "Wall of Force"],
  ]),

  ...bonusKnown("ranger", "fey-wanderer", [
    [3, "Charm Person"], [5, "Misty Step"], [9, "Dispel Magic"],
    [13, "Dimension Door"], [17, "Mislead"],
  ]),
  ...bonusKnown("ranger", "swarmkeeper", [
    [3, "Faerie Fire"], [5, "Web"], [9, "Gaseous Form"],
    [13, "Arcane Eye"], [17, "Insect Plague"],
  ]),
  ...bonusKnown("ranger", "gloom-stalker", [
    [3, "Disguise Self"], [5, "Rope Trick"], [9, "Fear"],
    [13, "Greater Invisibility"], [17, "Seeming"],
  ]),
  ...bonusKnown("ranger", "horizon-walker", [
    [3, "Protection from Evil and Good"], [5, "Misty Step"], [9, "Haste"],
    [13, "Banishment"], [17, "Teleportation Circle"],
  ]),
  ...bonusKnown("ranger", "monster-slayer", [
    [3, "Protection from Evil and Good"], [5, "Zone of Truth"], [9, "Magic Circle"],
    [13, "Banishment"], [17, "Hold Monster"],
  ]),

  ...alwaysPrepared("druid", "spores", [
    [3, "Blindness/Deafness", "Gentle Repose"], [5, "Animate Dead", "Gaseous Form"],
    [7, "Blight", "Confusion"], [9, "Cloudkill", "Contagion"],
  ]),
  ...alwaysPrepared("druid", "wildfire", [
    [2, "Burning Hands", "Cure Wounds"], [3, "Flaming Sphere", "Scorching Ray"],
    [5, "Plant Growth", "Revivify"], [7, "Aura of Life", "Fire Shield"],
    [9, "Flame Strike", "Mass Cure Wounds"],
  ]),

  ...alwaysPrepared("artificer", "alchemist", [
    [3, "Healing Word", "Ray of Sickness"], [5, "Flaming Sphere", "Melf's Acid Arrow"],
    [9, "Gaseous Form", "Mass Healing Word"], [13, "Blight", "Death Ward"],
    [17, "Cloudkill", "Raise Dead"],
  ]),
  ...alwaysPrepared("artificer", "artillerist", [
    [3, "Shield", "Thunderwave"], [5, "Scorching Ray", "Shatter"],
    [9, "Fireball", "Wind Wall"], [13, "Ice Storm", "Wall of Fire"],
    [17, "Cone of Cold", "Wall of Force"],
  ]),
  ...alwaysPrepared("artificer", "battle-smith", [
    [3, "Heroism", "Shield"], [5, "Branding Smite", "Warding Bond"],
    [9, "Aura of Vitality", "Conjure Barrage"], [13, "Aura of Purity", "Fire Shield"],
    [17, "Banishing Smite", "Mass Cure Wounds"],
  ]),
  ...alwaysPrepared("artificer", "armorer", [
    [3, "Magic Missile", "Thunderwave"], [5, "Mirror Image", "Shatter"],
    [9, "Hypnotic Pattern", "Lightning Bolt"], [13, "Fire Shield", "Greater Invisibility"],
    [17, "Passwall", "Wall of Force"],
  ]),
]

export function getClassSpellSelectionRule(
  character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  const normalizedLevel = clampLevel(classLevel)
  const classEntry = createClassEntry(className, normalizedLevel)
  const subclassCaster = getSubclassCasterRule(
    className,
    subclassId,
    normalizedLevel,
  )
  const dynamicGrants = getDynamicSubclassSpellGrants(
    character,
    className,
    subclassId,
    normalizedLevel,
  )
  const mode = subclassCaster?.mode ?? getBaseMode(className)

  return {
    className,
    classLevel: normalizedLevel,
    subclassId,
    mode,
    castingAttribute:
      subclassCaster?.castingAttribute ??
      (classEntry.castingAttribute as "int" | "wis" | "cha" | undefined),
    maxSpellLevel:
      subclassCaster?.maxSpellLevel ??
      getMaximumSpellLevel(className, normalizedLevel),
    maxCantrips:
      subclassCaster?.maxCantrips ??
      getCantripLimit(className, normalizedLevel),
    maxLeveledSpells:
      subclassCaster?.maxLeveledSpells ??
      getLeveledSpellLimit(character, classEntry, normalizedLevel),
    swap: getSpellSwapRule(className, normalizedLevel, mode),
    allowedSchools: subclassCaster?.allowedSchools,
    unrestrictedLeveledSpellCount:
      subclassCaster?.unrestrictedLeveledSpellCount,
    additionalClassLists: subclassCaster?.additionalClassLists,
    dynamicAutomaticSpellNames: dynamicGrants
      .filter((grant) => grant.mode !== "expanded-list")
      .map((grant) => grant.spellName),
    dynamicExpandedSpellNames: dynamicGrants
      .filter((grant) => grant.mode === "expanded-list")
      .map((grant) => grant.spellName),
  }
}

export function getSubclassSpellGrants(
  className: ClassName,
  subclassId: string | undefined,
  classLevel: number,
): SubclassSpellGrant[] {
  if (!subclassId) return []
  return SUBCLASS_SPELL_GRANTS.filter(
    (entry) =>
      entry.className === className &&
      entry.subclassId === subclassId &&
      entry.classLevel <= classLevel,
  )
}

export function isSpellAllowedForClassSelection(
  spell: Spell,
  rule: ClassSpellSelectionRule,
  _subclassSpellNames: string[],
): boolean {
  if (spell.slotLevel > rule.maxSpellLevel) return false
  if (spell.slotLevel === 0 && rule.maxCantrips <= 0) return false

  const grants = getSubclassSpellGrants(
    rule.className,
    rule.subclassId,
    rule.classLevel,
  )
  const automaticNames = [
    ...grants
      .filter((grant) => grant.mode !== "expanded-list")
      .flatMap((grant) => grant.spellNames),
    ...(rule.dynamicAutomaticSpellNames ?? []),
  ]
  if (spellMatchesAnyName(spell, automaticNames)) return false

  if (spell.classes.includes(rule.className)) return true
  if (
    rule.additionalClassLists?.some((className) =>
      spell.classes.includes(className),
    )
  ) {
    return true
  }

  const expandedNames = [
    ...grants
      .filter((grant) => grant.mode === "expanded-list")
      .flatMap((grant) => grant.spellNames),
    ...(rule.dynamicExpandedSpellNames ?? []),
  ]
  return spellMatchesAnyName(spell, expandedNames)
}

export function getMetamagicLimit(sorcererLevel: number): number {
  if (sorcererLevel < 3) return 0
  if (sorcererLevel >= 17) return 4
  if (sorcererLevel >= 10) return 3
  return 2
}

export function canReplaceMetamagicAtLevel(sorcererLevel: number): boolean {
  return ASI_LEVELS.includes(sorcererLevel)
}

export function getSubclassOptions(className: ClassName) {
  return getExpandedClassProgression(className).subclasses
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

function getCantripLimit(className: ClassName, level: number): number {
  const fromProgression = getExpandedCantripsKnownAtLevel(className, level)
  if (fromProgression > 0) return fromProgression
  return FALLBACK_CANTRIPS[className]?.[level] ?? 0
}

function getSpellSwapRule(
  className: ClassName,
  level: number,
  mode: SpellSelectionMode,
): SpellSwapRule {
  const cantripSwap =
    CANTRIP_VERSATILITY_CLASSES.includes(className) &&
    ASI_LEVELS.includes(level)
      ? 1
      : 0

  return {
    leveledKnown: mode === "limited-known" ? 1 : 0,
    cantrips: cantripSwap,
    onlyAtAsiLevel: cantripSwap > 0,
  }
}

function getSubclassCasterRule(
  className: ClassName,
  subclassId: string | undefined,
  level: number,
): Partial<ClassSpellSelectionRule> | undefined {
  if (className === "sorcerer" && subclassId === "divine-soul") {
    return { additionalClassLists: ["cleric"] }
  }

  if (level < 3) return undefined

  if (className === "fighter" && subclassId === "eldritch-knight") {
    return {
      mode: "limited-known",
      castingAttribute: "int",
      maxCantrips: level >= 10 ? 3 : 2,
      maxLeveledSpells: THIRD_CASTER_KNOWN[level] ?? 0,
      maxSpellLevel: Math.min(4, Math.ceil(level / 6)) as MagicCircleLevel,
      allowedSchools: ["abjuration", "evocation"],
      unrestrictedLeveledSpellCount: [3, 8, 14, 20].filter(
        (entry) => entry <= level,
      ).length,
    }
  }

  if (className === "rogue" && subclassId === "arcane-trickster") {
    return {
      mode: "limited-known",
      castingAttribute: "int",
      maxCantrips: level >= 10 ? 4 : 3,
      maxLeveledSpells: THIRD_CASTER_KNOWN[level] ?? 0,
      maxSpellLevel: Math.min(4, Math.ceil(level / 6)) as MagicCircleLevel,
      allowedSchools: ["enchantment", "illusion"],
      unrestrictedLeveledSpellCount: [3, 8, 14, 20].filter(
        (entry) => entry <= level,
      ).length,
    }
  }

  return undefined
}

function spellMatchesAnyName(spell: Spell, names: string[]): boolean {
  const candidates = new Set([
    normalizeSpellName(spell.name),
    normalizeSpellName(spell.displayName ?? ""),
  ])
  return names.some((name) => candidates.has(normalizeSpellName(name)))
}

function clampLevel(value: number): number {
  return Math.max(1, Math.min(20, Math.trunc(value || 1)))
}

function levelTable(values: number[]): Record<number, number> {
  return Object.fromEntries(values.map((value, index) => [index + 1, value]))
}

function thresholdTable(
  entries: Array<[number, number]>,
): Record<number, number> {
  const result: Record<number, number> = {}
  let current = 0

  for (let level = 1; level <= 20; level += 1) {
    const threshold = entries.find(([entryLevel]) => entryLevel === level)
    if (threshold) current = threshold[1]
    result[level] = current
  }

  return result
}

function grants(
  className: ClassName,
  subclassId: string,
  mode: SubclassSpellGrantMode,
  entries: SpellGrantEntry[],
): SubclassSpellGrant[] {
  return entries.map(([classLevel, ...spellNames]) => ({
    className,
    subclassId,
    classLevel,
    spellNames,
    mode,
  }))
}

function domain(id: string, entries: SpellGrantEntry[]) {
  return alwaysPrepared("cleric", id, entries)
}

function oath(id: string, entries: SpellGrantEntry[]) {
  return alwaysPrepared("paladin", id, entries)
}

function patron(id: string, entries: SpellGrantEntry[]) {
  return grants("warlock", id, "expanded-list", entries)
}

function bonusKnown(
  className: ClassName,
  id: string,
  entries: SpellGrantEntry[],
) {
  return grants(className, id, "bonus-known", entries)
}

function alwaysPrepared(
  className: ClassName,
  id: string,
  entries: SpellGrantEntry[],
) {
  return grants(className, id, "always-prepared", entries)
}
