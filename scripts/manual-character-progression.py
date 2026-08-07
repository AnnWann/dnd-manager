from pathlib import Path
import re
import shutil

ROOT = Path('.')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    target.write_text(text.replace(old, new, count))


def regex_replace(path: str, pattern: str, replacement: str, count: int = 1, flags: int = re.S) -> None:
    target = ROOT / path
    text = target.read_text()
    next_text, changed = re.subn(pattern, replacement, text, count=count, flags=flags)
    if changed != count:
        raise SystemExit(f"Expected {count} regex replacement(s) in {path}, got {changed}: {pattern[:120]!r}")
    target.write_text(next_text)


# ---------------------------------------------------------------------------
# Canonical class reference: no bundled feature/subclass catalog.
# ---------------------------------------------------------------------------
classes_dir = ROOT / 'src/data/classProgression/classes'
if classes_dir.exists():
    shutil.rmtree(classes_dir)

for obsolete in [
    'src/data/classProgression/ability.ts',
    'src/data/classProgression/applyProgressionAbilityConfig.ts',
    'src/data/classProgression/builders.ts',
    'src/data/classProgression/migration.ts',
]:
    target = ROOT / obsolete
    if target.exists():
        target.unlink()

write('src/data/classProgression/types.ts', '''import type { DieSides } from "../../models/dice/Die"
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
''')

write('src/data/classProgression/registry.ts', '''import type { ClassName } from "../../models/sheet/Class"
import type {
  ClassProgressionDefinition,
  LevelFeatureDefinition,
} from "./types"

export const ALL_CLASS_NAMES: readonly ClassName[] = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]

function classReference(
  className: ClassName,
  label: string,
  hitDie: ClassProgressionDefinition["hitDie"],
): ClassProgressionDefinition {
  return {
    className,
    label,
    hitDie,
    source: "manual",
    subclassLevel: 20,
    features: [],
    subclasses: [],
    cantripsKnown: {},
  }
}

/**
 * Only minimal mechanical class references are bundled. No subclass names,
 * feature names, feature text, choice lists, spell grants or progression tables
 * are shipped here.
 */
export const CLASS_PROGRESSIONS: Record<ClassName, ClassProgressionDefinition> = {
  artificer: classReference("artificer", "Artífice", "d8"),
  barbarian: classReference("barbarian", "Bárbaro", "d12"),
  bard: classReference("bard", "Bardo", "d8"),
  cleric: classReference("cleric", "Clérigo", "d8"),
  druid: classReference("druid", "Druida", "d8"),
  fighter: classReference("fighter", "Guerreiro", "d10"),
  monk: classReference("monk", "Monge", "d8"),
  paladin: classReference("paladin", "Paladino", "d10"),
  ranger: classReference("ranger", "Patrulheiro", "d10"),
  rogue: classReference("rogue", "Ladino", "d8"),
  sorcerer: classReference("sorcerer", "Feiticeiro", "d6"),
  warlock: classReference("warlock", "Bruxo", "d8"),
  wizard: classReference("wizard", "Mago", "d6"),
}

/** Compatibility export: there are intentionally no bundled progression modules. */
export const CLASS_PROGRESSION_MODULES = [] as const

export function getClassProgression(
  className: ClassName,
): ClassProgressionDefinition {
  return CLASS_PROGRESSIONS[className]
}

/** Bundled progression never materializes class/subclass features. */
export function getFeaturesAtLevel(
  _className: ClassName,
  _level: number,
  _subclassId?: string,
): LevelFeatureDefinition[] {
  return []
}

/** Cantrip limits are no longer inferred by progression. */
export function getCantripsKnownAtLevel(
  _className: ClassName,
  _level: number,
): number {
  return 0
}
''')

write('src/data/classProgression/index.ts', '''export * from "./registry"
export * from "./types"
''')

write('src/data/classProgression/README.md', '''# Manual class progression

This directory intentionally contains **no bundled class features, subclass
catalog, option lists or subclass spell grants**.

The application keeps only minimal class metadata needed by the character sheet
(class identifier, display label and hit die). Character creation and level-up
are data-entry workflows: the player uses their own rules reference and enters
the subclass and every gained ability manually.

## What the application does not infer

- when a subclass is gained;
- which subclasses exist;
- which class or subclass features are gained at a level;
- feature descriptions;
- invocations, maneuvers, fighting styles, metamagic or similar choice lists;
- automatic subclass spell grants;
- class spell-selection limits inside progression;
- multiclass prerequisites or class proficiency packages.

## Adding a class feature

During character creation or level-up, use **Adicionar característica**. The
normal ability editor supports descriptions, actions, usage counters, formulas,
bonuses, granted spells, granted proficiencies and other generic ability fields.
The entered data belongs to the user's character; it is not copied from a
bundled rules catalog.

## Subclasses

Subclass name and optional source/reference are free-text fields. The app stores
what the user enters and does not validate the name against a catalog.

## Existing characters

Existing abilities and subclass selections remain character-owned data. Removing
the bundled catalog does not delete them. New progression events simply stop
generating rules content automatically.
''')

# ---------------------------------------------------------------------------
# Remove class-progression migration from character hydration.
# ---------------------------------------------------------------------------
character_path = ROOT / 'src/models/characters/CharacterTemplate.ts'
character_text = character_path.read_text()
character_text = character_text.replace(
    'import { migrateCharacterProgressionData } from "../../data/classProgression/migration"\n',
    '',
)
character_text = character_text.replace(
    '  /** Canonical class/subclass feature data applied to this character. */\n  classProgressionVersion?: number\n\n',
    '',
)
character_text = character_text.replace(
    '      classProgressionVersion: props.classProgressionVersion ?? 0,\n',
    '',
)
character_text = character_text.replace(
    '    return migrateCharacterProgressionData(character)\n',
    '    return character\n',
)
character_path.write_text(character_text)

# ---------------------------------------------------------------------------
# Class model: preserve only basic casting metadata, not known/prepared tables.
# ---------------------------------------------------------------------------
class_path = ROOT / 'src/models/sheet/Class.ts'
class_text = class_path.read_text()
class_text = class_text.replace('export type ClassSourceBook = "PHB" | "Tasha" | "Xanathar"', 'export type ClassSourceBook = string')
class_text = re.sub(
    r'\nconst BARD_KNOWN_SPELLS: KnownSpellsRule = \{.*?\nexport class CharacterClassBuilder \{',
    '\nexport class CharacterClassBuilder {',
    class_text,
    count=1,
    flags=re.S,
)
for name in [
    'BARD_KNOWN_SPELLS',
    'CLERIC_PREPARED_SPELLS',
    'DRUID_PREPARED_SPELLS',
    'PALADIN_PREPARED_SPELLS',
    'RANGER_KNOWN_SPELLS',
    'SORCERER_KNOWN_SPELLS',
    'WARLOCK_KNOWN_SPELLS',
    'WIZARD_PREPARED_SPELLS',
    'ARTIFICER_PREPARED_SPELLS',
]:
    class_text = class_text.replace(f',\n      {name}', '')
class_path.write_text(class_text)

# ---------------------------------------------------------------------------
# Generic/manual progression rules. No subclass or choice catalogs.
# ---------------------------------------------------------------------------
write('src/models/leveling/SpellSelectionRules.ts', '''import type { CharacterTemplate } from "../characters/CharacterTemplate"
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
 * Progression intentionally does not infer spell-selection rules. Spells may be
 * added manually from the character sheet or by generic ability grants.
 */
export function getClassSpellSelectionRule(
  _character: CharacterTemplate,
  className: ClassName,
  classLevel: number,
  subclassId?: string,
): ClassSpellSelectionRule {
  return {
    className,
    classLevel: clampLevel(classLevel),
    subclassId,
    mode: "none",
    maxSpellLevel: 0,
    maxCantrips: 0,
    maxLeveledSpells: 0,
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

export function isSpellAllowedForClassSelection(
  _spell: Spell,
  _rule: ClassSpellSelectionRule,
  _subclassSpellNames: string[],
): boolean {
  return false
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
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function clampLevel(value: number): number {
  return Math.max(1, Math.min(20, Math.trunc(value || 1)))
}
''')

write('src/models/leveling/DynamicSubclassSpellRules.ts', '''import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { ClassName } from "../sheet/Class"

export type DynamicSubclassSpellMode =
  | "expanded-list"
  | "always-prepared"
  | "bonus-known"

export type DynamicSubclassSpellGrant = {
  className: ClassName
  subclassId: string
  classLevel: number
  spellName: string
  mode: DynamicSubclassSpellMode
  sourceName: string
}

/** No subclass spell catalog is bundled. */
export function getDynamicSubclassSpellGrants(
  _character: CharacterTemplate,
  _className: ClassName,
  _subclassId: string | undefined,
  _classLevel: number,
): DynamicSubclassSpellGrant[] {
  return []
}
''')

write('src/models/leveling/MulticlassRequirements.ts', '''import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"

export type MulticlassRequirementGroup = {
  mode: "all" | "any"
  requirements: Array<{ attribute: Attribute; minimum: number }>
}

export type MulticlassRequirementResult = {
  allowed: boolean
  isMulticlassEntry: boolean
  failures: Array<{
    className: ClassName
    classLabel: string
    requirement: string
  }>
}

const CLASS_NAMES: ClassName[] = [
  "artificer", "barbarian", "bard", "cleric", "druid", "fighter",
  "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
]

/** No multiclass prerequisite table is bundled; users consult their reference. */
export const MULTICLASS_REQUIREMENTS = Object.fromEntries(
  CLASS_NAMES.map((className) => [className, { mode: "all", requirements: [] }]),
) as Record<ClassName, MulticlassRequirementGroup>

export function checkMulticlassRequirements(
  character: CharacterTemplate,
  targetClass: ClassName,
): MulticlassRequirementResult {
  const classes = character.get("sheet").classes ?? []
  return {
    allowed: true,
    isMulticlassEntry:
      classes.length > 0 && !classes.some((entry) => entry.className === targetClass),
    failures: [],
  }
}

export function formatClassMulticlassRequirement(_className: ClassName): string {
  return "consulte sua referência"
}
''')

write('src/models/leveling/ClassProficiencyRules.ts', '''import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import type { Proficiency, ProficiencyCategory } from "../sheet/Proficiency"
import type { Skill } from "../sheet/Skills"

export type ClassProficiencySelection = {
  className: ClassName
  previousLevel: number
  selectedSkills?: Skill[]
  selectedToolOrInstrument?: string
}

export type ClassSkillRule = {
  count: number
  options: Skill[] | "any"
}

export type ClassProficiencyRule = {
  savingThrows: Attribute[]
  initial: Proficiency[]
  multiclass: Proficiency[]
  initialSkills?: ClassSkillRule
  multiclassSkills?: ClassSkillRule
  multiclassChoiceLabel?: string
  multiclassChoiceCategory?: ProficiencyCategory
}

const CLASS_NAMES: ClassName[] = [
  "artificer", "barbarian", "bard", "cleric", "druid", "fighter",
  "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
]
const EMPTY_RULE: ClassProficiencyRule = {
  savingThrows: [],
  initial: [],
  multiclass: [],
}

/** No class proficiency package is bundled; users configure it on the sheet. */
export const CLASS_PROFICIENCY_RULES = Object.fromEntries(
  CLASS_NAMES.map((className) => [className, EMPTY_RULE]),
) as Record<ClassName, ClassProficiencyRule>

export function getClassProficiencyRule(className: ClassName): ClassProficiencyRule {
  return CLASS_PROFICIENCY_RULES[className]
}

export function applyClassProficiencies(
  character: CharacterTemplate,
  _selections: ClassProficiencySelection[],
  _initialClassName?: ClassName,
): CharacterTemplate {
  return character
}

export function validateClassProficiencySelections(
  _selections: ClassProficiencySelection[],
  _initialClassName?: ClassName,
): string {
  return ""
}
''')

# ---------------------------------------------------------------------------
# Generic application: only user-entered subclass/features/spells are persisted.
# ---------------------------------------------------------------------------
write('src/models/leveling/applyCharacterProgression.ts', '''import type { Ability } from "../abilities/Ability"
import {
  createCharacterAcquisition,
  type CharacterAcquisitionReason,
} from "../characters/CharacterAcquisition"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { ensureCharacterAcquisitionMetadata } from "../characters/characterAcquisitionMetadata"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { Spell } from "../magic/spells/Spell"
import type { ClassName } from "../sheet/Class"
import type { HP } from "../sheet/HP"
import { getClassProgression } from "../../data/classProgression"
import { createClassEntry } from "./SpellSelectionRules"

export type ProgressionClassPlan = {
  className: ClassName
  level: number
  previousLevel: number
  subclassId?: string
  subclassName?: string
  subclassSource?: string
  levelChoices: Record<string, string[]>
  enabledOptionalFeatureIds: string[]
}

export type ProgressionSpellSelection = {
  className: ClassName
  spellIndexes: string[]
  preparedSpellIndexes: string[]
}

export type ProgressionCustomAbility = {
  ability: Ability
  source: "class" | "race"
  className?: ClassName
  classLevel?: number
}

export type CharacterProgressionApplication = {
  mode: "creation" | "level-up"
  classPlans: ProgressionClassPlan[]
  spellSelections: ProgressionSpellSelection[]
  /** Kept for API compatibility; progression no longer infers metamagic. */
  metamagics?: MetamagicId[]
  customAbilities: ProgressionCustomAbility[]
  spells: Spell[]
  advancedClassName?: ClassName
  hpGain?: number
  eventId?: string
  addedAt?: string
}

export function applyCharacterProgression(
  character: CharacterTemplate,
  application: CharacterProgressionApplication,
): CharacterTemplate {
  const eventId = application.eventId ?? crypto.randomUUID()
  const addedAt = application.addedAt ?? new Date().toISOString()
  const reason: CharacterAcquisitionReason =
    application.mode === "creation" ? "character-creation" : "level-up"
  const totalLevel = application.classPlans.reduce(
    (sum, plan) => sum + plan.level,
    0,
  )
  const classLabels = new Map<ClassName, string>(
    application.classPlans.map((plan) => [
      plan.className,
      getClassProgression(plan.className).label,
    ]),
  )

  const previousClasses = character.get("sheet").classes ?? []
  const classes = application.classPlans.map((plan) => {
    const previous = previousClasses.find(
      (entry) => entry.className === plan.className,
    )
    const subclassName = plan.subclassName?.trim() || previous?.subclass?.name
    const subclassSource =
      plan.subclassSource?.trim() || previous?.subclass?.source || "Manual"
    const subclassId =
      plan.subclassId || previous?.subclass?.id || slug(subclassName ?? "")

    return {
      ...createClassEntry(plan.className, plan.level),
      subclass: subclassName
        ? {
            id: subclassId || slug(subclassName),
            name: subclassName,
            source: subclassSource,
          }
        : undefined,
      levelChoices: compactChoices(plan.levelChoices),
    }
  })

  let updated = character.withSheet("classes", classes)

  if (application.mode === "creation") {
    updated = recalculateCreationHp(updated, application.classPlans)
  } else if (
    application.advancedClassName &&
    application.hpGain !== undefined
  ) {
    updated = addLevelUpHp(
      updated,
      application.advancedClassName,
      application.hpGain,
    )
  }

  const customClassAbilities = application.customAbilities
    .filter((entry) => entry.source === "class")
    .map((entry) => {
      const className = entry.className ?? application.advancedClassName
      const classPlan = application.classPlans.find(
        (plan) => plan.className === className,
      )
      return stampAbility(entry.ability, {
        eventId,
        addedAt,
        reason,
        characterLevel: totalLevel,
        className,
        classLevel: entry.classLevel ?? classPlan?.level,
        sourceType: "class",
        sourceId: className,
        sourceName: className ? classLabels.get(className) : "Classe",
      })
    })
  const customClassIds = new Set(
    customClassAbilities.map((ability) => ability.id),
  )
  updated = updated.with("abilities", [
    ...(updated.get("abilities") ?? []).filter(
      (ability) => !customClassIds.has(ability.id),
    ),
    ...customClassAbilities,
  ])

  const race = updated.get("sheet").race
  const raceName = race.customName?.trim() || race.subrace?.trim() || race.race
  const customRacialAbilities = application.customAbilities
    .filter((entry) => entry.source === "race")
    .map((entry) =>
      stampAbility(entry.ability, {
        eventId,
        addedAt,
        reason,
        characterLevel: totalLevel,
        sourceType: "race",
        sourceId: String(race.race),
        sourceName: raceName,
      }),
    )
  if (customRacialAbilities.length) {
    const customIds = new Set(customRacialAbilities.map((ability) => ability.id))
    updated = updated.withSheet("race", {
      ...race,
      naturalAbilities: [
        ...(race.naturalAbilities ?? []).filter(
          (ability) => !customIds.has(ability.id),
        ),
        ...customRacialAbilities,
      ],
    })
  }

  if (application.spellSelections.length) {
    updated = applyManualSpellSelections(
      updated,
      application,
      eventId,
      addedAt,
      reason,
      classLabels,
    )
  }
  updated = updated.syncMagicWithClasses()

  return ensureCharacterAcquisitionMetadata(updated, {
    eventId,
    addedAt,
    reason,
    characterLevel: totalLevel,
    className: application.advancedClassName,
    classLevel: application.advancedClassName
      ? application.classPlans.find(
          (plan) => plan.className === application.advancedClassName,
        )?.level
      : undefined,
    sourceType:
      application.mode === "creation" ? "characterCreation" : "class",
    sourceName:
      application.mode === "creation"
        ? "Criação de personagem"
        : application.advancedClassName
          ? classLabels.get(application.advancedClassName)
          : "Subida de nível",
  })
}

function stampAbility(
  ability: Ability,
  acquisitionInput: Parameters<typeof createCharacterAcquisition>[0],
): Ability {
  const acquisition = createCharacterAcquisition(acquisitionInput)
  return {
    ...ability,
    acquisition,
    grantedSpells: ability.grantedSpells?.map((grant) => ({
      ...grant,
      acquisition:
        grant.acquisition ??
        createCharacterAcquisition({
          ...acquisition,
          sourceType: "ability",
          sourceId: ability.id,
          sourceName: ability.name,
        }),
    })),
  }
}

function applyManualSpellSelections(
  character: CharacterTemplate,
  application: CharacterProgressionApplication,
  eventId: string,
  addedAt: string,
  reason: CharacterAcquisitionReason,
  classLabels: Map<ClassName, string>,
): CharacterTemplate {
  const affectedClasses = new Set(
    application.spellSelections.map((selection) => selection.className),
  )
  const currentMagic = character.get("magic") ?? {
    spells: {
      knownSpells: [],
      slots: {},
      pactSlots: { level: 0, max: 0, current: 0 },
    },
  }
  const retained = currentMagic.spells.knownSpells.filter(
    (entry) =>
      entry.source.type !== "class" ||
      !affectedClasses.has(
        resolveSpellSourceClass(entry.source.sourceId, entry.source.name),
      ),
  )
  const byIndex = new Map(application.spells.map((spell) => [spell.index, spell]))
  const additions = [] as typeof currentMagic.spells.knownSpells

  for (const selection of application.spellSelections) {
    const plan = application.classPlans.find(
      (entry) => entry.className === selection.className,
    )
    if (!plan) continue
    const existingForClass = new Map(
      currentMagic.spells.knownSpells
        .filter(
          (entry) =>
            entry.source.type === "class" &&
            resolveSpellSourceClass(entry.source.sourceId, entry.source.name) ===
              selection.className,
        )
        .map((entry) => [entry.spells.id, entry]),
    )
    const classAcquisition = createCharacterAcquisition({
      eventId,
      addedAt,
      reason,
      characterLevel: application.classPlans.reduce(
        (sum, entry) => sum + entry.level,
        0,
      ),
      className: selection.className,
      classLevel: plan.level,
      sourceType: "class",
      sourceId: selection.className,
      sourceName: classLabels.get(selection.className),
    })

    for (const spellIndex of selection.spellIndexes) {
      if (!byIndex.has(spellIndex)) continue
      const existing = existingForClass.get(spellIndex)
      additions.push({
        source: {
          ...(existing?.source ?? {}),
          type: "class",
          name: selection.className,
          sourceId: selection.className,
          attribute:
            createClassEntry(selection.className, plan.level).castingAttribute ??
            "int",
          extendedList: false,
        },
        spells: {
          id: spellIndex,
          prepared: selection.preparedSpellIndexes.includes(spellIndex),
        },
        acquisition: existing?.acquisition ?? classAcquisition,
      })
    }
  }

  return character.with("magic", {
    ...currentMagic,
    spells: {
      ...currentMagic.spells,
      knownSpells: uniqueKnownSpells([...retained, ...additions]),
    },
  })
}

function recalculateCreationHp(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  const conModifier = character.getAttributeModifier("con")
  const hitDice: HP["hitDice"] = {}
  let max = 0
  let firstLevel = true

  for (const plan of plans) {
    const hitDie = getClassProgression(plan.className).hitDie
    const sides = Number(hitDie.slice(1)) || 6
    const currentHitDice = hitDice[hitDie] ?? {
      max: { quantity: 0, sides: hitDie },
      current: { quantity: 0, sides: hitDie },
    }
    hitDice[hitDie] = {
      max: {
        quantity: currentHitDice.max.quantity + plan.level,
        sides: hitDie,
      },
      current: {
        quantity: currentHitDice.current.quantity + plan.level,
        sides: hitDie,
      },
    }

    for (let level = 1; level <= plan.level; level += 1) {
      max += Math.max(
        1,
        (firstLevel ? sides : Math.floor(sides / 2) + 1) + conModifier,
      )
      firstLevel = false
    }
  }

  return character.withSheet("HP", {
    max: Math.max(1, max),
    current: Math.max(1, max),
    temporary: 0,
    hitDice,
  })
}

function addLevelUpHp(
  character: CharacterTemplate,
  className: ClassName,
  hpGain: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const hitDie = getClassProgression(className).hitDie
  const currentHitDice = hp.hitDice[hitDie] ?? {
    max: { quantity: 0, sides: hitDie },
    current: { quantity: 0, sides: hitDie },
  }
  const gain = Math.max(1, Math.trunc(hpGain))
  return character.withSheet("HP", {
    ...hp,
    max: hp.max + gain,
    current: hp.current + gain,
    hitDice: {
      ...hp.hitDice,
      [hitDie]: {
        max: {
          quantity: currentHitDice.max.quantity + 1,
          sides: hitDie,
        },
        current: {
          quantity: currentHitDice.current.quantity + 1,
          sides: hitDie,
        },
      },
    },
  })
}

function compactChoices(
  choices: Record<string, string[]>,
): Record<string, string[]> | undefined {
  const entries = Object.entries(choices).filter(([, values]) => values.length)
  return entries.length ? Object.fromEntries(entries) : undefined
}

function resolveSpellSourceClass(
  sourceId: string | undefined,
  sourceName: string,
): ClassName | undefined {
  const raw = String(sourceId ?? sourceName)
  return raw.split(":")[0] as ClassName
}

function uniqueKnownSpells<T extends { spells: { id: string }; source: { type: string; sourceId?: string } }>(
  entries: T[],
): T[] {
  const byKey = new Map<string, T>()
  for (const entry of entries) {
    const key = `${entry.source.type}:${entry.source.sourceId ?? ""}:${entry.spells.id}`
    byKey.set(key, entry)
  }
  return Array.from(byKey.values())
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
''')

# ---------------------------------------------------------------------------
# Simplified progression flow: no feature/subclass bridges or hardcoded finalizers.
# ---------------------------------------------------------------------------
write('src/features/characters/progression/CharacterProgressionFlow.tsx', '''import type { ComponentProps } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>

export function CharacterProgressionFlow(props: Props) {
  return <CharacterProgressionConfigurator {...props} />
}

/** Compatibility helper: subclass spells are no longer generated automatically. */
export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
): CharacterTemplate {
  return character
}
''')

# ---------------------------------------------------------------------------
# Manual progression configurator.
# ---------------------------------------------------------------------------
write('src/features/characters/progression/CharacterProgressionConfigurator.tsx', '''import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import { ALL_CLASS_NAMES, getClassProgression } from "../../../data/classProgression"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import { createClassEntry } from "../../../models/leveling/SpellSelectionRules"
import {
  applyCharacterProgression,
  type ProgressionClassPlan,
  type ProgressionCustomAbility,
  type ProgressionSpellSelection,
} from "../../../models/leveling/applyCharacterProgression"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  mode: "creation" | "level-up"
  character: CharacterTemplate
  targetTotalLevel?: number
  primaryClassName?: ClassName
  onCancel: () => void
  onComplete: (character: CharacterTemplate) => void
}

type Step = "classes" | "features" | "spells" | "review"
type HpMode = "average" | "manual" | "rolled"
type AbilitySource = "class" | "race"
type SpellSelectionState = Record<
  string,
  { selected: string[]; prepared: string[] }
>

export function CharacterProgressionConfigurator({
  mode,
  character,
  targetTotalLevel,
  primaryClassName,
  onCancel,
  onComplete,
}: Props) {
  const { spells } = useMagicContext()
  const existingClasses = character.get("sheet").classes ?? []
  const existingTotal = existingClasses.reduce((sum, entry) => sum + entry.level, 0)
  const creationTotal = Math.max(1, Math.min(20, targetTotalLevel ?? existingTotal || 1))
  const initialAdvancedClass = primaryClassName ?? existingClasses[0]?.className ?? "fighter"
  const [step, setStep] = useState<Step>("classes")
  const [advancedClassName, setAdvancedClassName] = useState<ClassName>(initialAdvancedClass)
  const [classPlans, setClassPlans] = useState<ProgressionClassPlan[]>(() =>
    createInitialPlans(mode, character, creationTotal, initialAdvancedClass),
  )
  const [customAbilities, setCustomAbilities] = useState<ProgressionCustomAbility[]>([])
  const [abilitySource, setAbilitySource] = useState<AbilitySource | null>(null)
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null)
  const [customAbilityClass, setCustomAbilityClass] = useState<ClassName>(initialAdvancedClass)
  const [customAbilityLevel, setCustomAbilityLevel] = useState(1)
  const [abilityLevels, setAbilityLevels] = useState<Partial<Record<ClassName, number>>>({})
  const [spellSelections, setSpellSelections] = useState<SpellSelectionState>(() =>
    createInitialSpellSelections(character, classPlans),
  )
  const [spellQueries, setSpellQueries] = useState<Partial<Record<ClassName, string>>>({})
  const [hpMode, setHpMode] = useState<HpMode>("average")
  const [manualHp, setManualHp] = useState("")
  const [rolledDie, setRolledDie] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState("")

  const finalTotal = classPlans.reduce((sum, plan) => sum + plan.level, 0)
  const configuredCharacter = useMemo(
    () => characterWithPlans(character, classPlans),
    [character, classPlans],
  )
  const advancedProgression = getClassProgression(advancedClassName)
  const conModifier = configuredCharacter.getAttributeModifier("con")
  const averageDie = Math.floor(Number(advancedProgression.hitDie.slice(1)) / 2) + 1
  const averageHp = Math.max(1, averageDie + conModifier)
  const hpGain = hpMode === "manual"
    ? Math.max(1, Math.trunc(Number(manualHp) || 1))
    : hpMode === "rolled"
      ? Math.max(1, (rolledDie ?? averageDie) + conModifier)
      : averageHp

  function updatePlan(
    className: ClassName,
    updater: (plan: ProgressionClassPlan) => ProgressionClassPlan,
  ) {
    setClassPlans((current) =>
      current.map((plan) => plan.className === className ? updater(plan) : plan),
    )
  }

  function changeAdvancedClass(className: ClassName) {
    setAdvancedClassName(className)
    if (mode !== "level-up") return
    setClassPlans(createLevelUpPlans(character, className))
    setCustomAbilityClass(className)
    setValidationMessage("")
  }

  function addMulticlass(className: ClassName) {
    if (mode !== "creation" || classPlans.some((plan) => plan.className === className)) return
    const donor = classPlans.find((plan) => plan.level > 1)
    if (!donor) return
    setClassPlans((current) => [
      ...current.map((plan) => plan.className === donor.className
        ? { ...plan, level: plan.level - 1 }
        : plan),
      createPlan(className, 1, 0),
    ])
  }

  function removeMulticlass(className: ClassName) {
    if (mode !== "creation" || classPlans.length <= 1) return
    const removed = classPlans.find((plan) => plan.className === className)
    const receiver = classPlans.find((plan) => plan.className !== className)
    if (!removed || !receiver) return
    setClassPlans((current) => current
      .filter((plan) => plan.className !== className)
      .map((plan) => plan.className === receiver.className
        ? { ...plan, level: plan.level + removed.level }
        : plan))
  }

  function shiftClassLevel(className: ClassName, delta: -1 | 1) {
    if (mode !== "creation") return
    const target = classPlans.find((plan) => plan.className === className)
    if (!target || (delta < 0 && target.level <= 1)) return
    const other = delta > 0
      ? classPlans.find((plan) => plan.className !== className && plan.level > 1)
      : classPlans.find((plan) => plan.className !== className)
    if (!other) return
    setClassPlans((current) => current.map((plan) => {
      if (plan.className === className) return { ...plan, level: plan.level + delta }
      if (plan.className === other.className) return { ...plan, level: plan.level - delta }
      return plan
    }))
  }

  function openAbilityEditor(source: AbilitySource, className?: ClassName, level?: number) {
    setAbilitySource(source)
    setEditingAbility(null)
    setCustomAbilityClass(className ?? classPlans[0].className)
    setCustomAbilityLevel(level ?? classPlans[0].level)
  }

  function saveCustomAbility(ability: Ability) {
    if (!abilitySource) return
    const entry: ProgressionCustomAbility = {
      ability,
      source: abilitySource,
      className: abilitySource === "class" ? customAbilityClass : undefined,
      classLevel: abilitySource === "class" ? customAbilityLevel : undefined,
    }
    setCustomAbilities((current) => {
      const exists = current.some((candidate) => candidate.ability.id === ability.id)
      return exists
        ? current.map((candidate) => candidate.ability.id === ability.id ? entry : candidate)
        : [...current, entry]
    })
    setAbilitySource(null)
    setEditingAbility(null)
  }

  function toggleSpell(className: ClassName, spellIndex: string) {
    setSpellSelections((current) => {
      const state = current[className] ?? { selected: [], prepared: [] }
      const selected = state.selected.includes(spellIndex)
      return {
        ...current,
        [className]: {
          selected: selected
            ? state.selected.filter((entry) => entry !== spellIndex)
            : [...state.selected, spellIndex],
          prepared: selected
            ? state.prepared.filter((entry) => entry !== spellIndex)
            : state.prepared,
        },
      }
    })
  }

  function togglePrepared(className: ClassName, spellIndex: string) {
    setSpellSelections((current) => {
      const state = current[className] ?? { selected: [], prepared: [] }
      if (!state.selected.includes(spellIndex)) return current
      return {
        ...current,
        [className]: {
          ...state,
          prepared: state.prepared.includes(spellIndex)
            ? state.prepared.filter((entry) => entry !== spellIndex)
            : [...state.prepared, spellIndex],
        },
      }
    })
  }

  function confirm() {
    if (mode === "creation" && finalTotal !== creationTotal) {
      setValidationMessage(`Distribua exatamente ${creationTotal} níveis entre as classes.`)
      setStep("review")
      return
    }
    if (mode === "level-up" && finalTotal !== existingTotal + 1) {
      setValidationMessage("A subida de nível deve adicionar exatamente um nível total.")
      setStep("review")
      return
    }

    const selections: ProgressionSpellSelection[] = classPlans.map((plan) => ({
      className: plan.className,
      spellIndexes: spellSelections[plan.className]?.selected ?? [],
      preparedSpellIndexes: spellSelections[plan.className]?.prepared ?? [],
    }))

    onComplete(applyCharacterProgression(character, {
      mode,
      classPlans,
      spellSelections: selections,
      customAbilities,
      spells,
      advancedClassName: mode === "level-up" ? advancedClassName : undefined,
      hpGain: mode === "level-up" ? hpGain : undefined,
    }))
  }

  const steps: Array<{ id: Step; label: string }> = [
    { id: "classes", label: "Classes" },
    { id: "features", label: "Características" },
    { id: "spells", label: "Magias manuais" },
    { id: "review", label: "Revisão" },
  ]

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-textH">
              {mode === "creation" ? "Progressão inicial manual" : "Subir de nível manualmente"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              Use sua própria referência. O aplicativo não sugere subclasses, características ou escolhas de classe.
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStep(entry.id)}
              className={step === entry.id
                ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH"
                : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-textMuted"}
            >
              {index + 1}. {entry.label}
            </button>
          ))}
        </div>
      </header>

      {step === "classes" ? (
        <div className="grid gap-4">
          {mode === "level-up" ? (
            <label className="grid gap-1.5 rounded-xl border border-border bg-bg-subtle p-4 text-xs text-text">
              Classe que recebe o nível
              <Select value={advancedClassName} onChange={(event) => changeAdvancedClass(event.target.value as ClassName)}>
                {ALL_CLASS_NAMES.map((className) => {
                  const current = existingClasses.find((entry) => entry.className === className)?.level
                  return (
                    <option key={className} value={className}>
                      {getClassProgression(className).label} {current ? `${current} → ${current + 1}` : "1 (multiclasse)"}
                    </option>
                  )
                })}
              </Select>
            </label>
          ) : (
            <ManualMulticlassControls
              classPlans={classPlans}
              creationTotal={creationTotal}
              onAdd={addMulticlass}
            />
          )}

          {classPlans.map((plan, index) => (
            <article key={plan.className} className="grid gap-4 rounded-xl border border-border bg-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-textH">{getClassProgression(plan.className).label} {plan.level}</h2>
                  <p className="mt-1 text-xs text-textMuted">
                    {getClassProgression(plan.className).hitDie} · {index === 0 ? "classe inicial" : "multiclasse"}
                  </p>
                </div>
                {mode === "creation" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={plan.level <= 1} onClick={() => shiftClassLevel(plan.className, -1)}>− nível</Button>
                    <Button size="sm" variant="secondary" disabled={!classPlans.some((entry) => entry.className !== plan.className && entry.level > 1)} onClick={() => shiftClassLevel(plan.className, 1)}>+ nível</Button>
                    {classPlans.length > 1 ? <Button size="sm" variant="ghost" onClick={() => removeMulticlass(plan.className)}>Remover</Button> : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-text">
                  Subclasse (manual)
                  <Input
                    value={plan.subclassName ?? ""}
                    placeholder="Digite conforme sua referência"
                    onChange={(event) => updatePlan(plan.className, (current) => ({
                      ...current,
                      subclassName: event.target.value,
                      subclassId: undefined,
                    }))}
                  />
                </label>
                <label className="grid gap-1.5 text-xs text-text">
                  Fonte / livro (opcional)
                  <Input
                    value={plan.subclassSource ?? ""}
                    placeholder="Sua referência"
                    onChange={(event) => updatePlan(plan.className, (current) => ({
                      ...current,
                      subclassSource: event.target.value,
                    }))}
                  />
                </label>
              </div>
            </article>
          ))}

          {mode === "level-up" ? (
            <section className="rounded-xl border border-border bg-bg-subtle p-4">
              <h2 className="font-semibold text-textH">Pontos de vida</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={hpMode === "average" ? "primary" : "secondary"} onClick={() => setHpMode("average")}>Média (+{averageHp})</Button>
                <Button size="sm" variant={hpMode === "manual" ? "primary" : "secondary"} onClick={() => setHpMode("manual")}>Manual</Button>
                <Button size="sm" variant={hpMode === "rolled" ? "primary" : "secondary"} onClick={() => {
                  const sides = Number(advancedProgression.hitDie.slice(1)) || 6
                  setRolledDie(Math.floor(Math.random() * sides) + 1)
                  setHpMode("rolled")
                }}>Rolar {advancedProgression.hitDie}</Button>
              </div>
              {hpMode === "manual" ? (
                <Input className="mt-3 max-w-40" type="number" min={1} value={manualHp} onChange={(event) => setManualHp(event.target.value)} />
              ) : null}
              <p className="mt-3 text-xs text-textMuted">Ganho aplicado: +{hpGain} PV.</p>
            </section>
          ) : null}
        </div>
      ) : null}

      {step === "features" ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
            Consulte sua referência e cadastre somente as características recebidas. O editor de habilidade permite configurar descrição, usos, fórmulas, bônus e magias concedidas.
          </div>
          {classPlans.map((plan) => {
            const requestedLevel = Math.max(
              mode === "creation" ? 1 : plan.previousLevel + 1,
              Math.min(plan.level, abilityLevels[plan.className] ?? plan.level),
            )
            const entries = customAbilities.filter((entry) => entry.source === "class" && entry.className === plan.className)
            return (
              <section key={plan.className} className="rounded-xl border border-border bg-bg-subtle p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-textH">{getClassProgression(plan.className).label}</h2>
                    <p className="mt-1 text-xs text-textMuted">Nenhuma característica é adicionada automaticamente.</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="grid gap-1 text-[11px] text-textMuted">
                      Nível da classe
                      <Input
                        className="w-24"
                        type="number"
                        min={mode === "creation" ? 1 : plan.previousLevel + 1}
                        max={plan.level}
                        value={requestedLevel}
                        onChange={(event) => setAbilityLevels((current) => ({ ...current, [plan.className]: Number(event.target.value) }))}
                      />
                    </label>
                    <Button size="sm" onClick={() => openAbilityEditor("class", plan.className, requestedLevel)}>Adicionar característica</Button>
                  </div>
                </div>
                <AbilityEntries entries={entries} onEdit={(entry) => {
                  setAbilitySource(entry.source)
                  setEditingAbility(entry.ability)
                  setCustomAbilityClass(entry.className ?? plan.className)
                  setCustomAbilityLevel(entry.classLevel ?? plan.level)
                }} onRemove={(id) => setCustomAbilities((current) => current.filter((entry) => entry.ability.id !== id))} />
              </section>
            )
          })}
          <section className="rounded-xl border border-border bg-bg-subtle p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">Característica racial manual</h2>
                <p className="mt-1 text-xs text-textMuted">Use apenas se uma característica racial for liberada neste nível.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => openAbilityEditor("race")}>Adicionar racial</Button>
            </div>
          </section>
        </div>
      ) : null}

      {step === "spells" ? (
        <ManualSpellsStep
          classPlans={classPlans}
          spells={spells}
          selections={spellSelections}
          queries={spellQueries}
          onQueryChange={(className, value) => setSpellQueries((current) => ({ ...current, [className]: value }))}
          onToggleSpell={toggleSpell}
          onTogglePrepared={togglePrepared}
        />
      ) : null}

      {step === "review" ? (
        <div className="grid gap-4">
          <section className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-4">
            <Summary label="Classes" value={classPlans.map((plan) => `${getClassProgression(plan.className).label} ${plan.level}${plan.subclassName?.trim() ? ` — ${plan.subclassName.trim()}` : ""}`).join(" / ")} />
            <Summary label="Características adicionadas" value={String(customAbilities.length)} />
            <Summary label="Magias selecionadas manualmente" value={String(Object.values(spellSelections).reduce((sum, entry) => sum + entry.selected.length, 0))} />
            {mode === "level-up" ? <Summary label="PV ganhos" value={`+${hpGain}`} /> : null}
          </section>
          <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
            O aplicativo gravará apenas o que você digitou ou selecionou. Nenhuma característica ou subclasse será inferida a partir da classe.
          </div>
          {validationMessage ? <div className="rounded-xl border border-danger bg-dangerBg p-4 text-sm text-danger">{validationMessage}</div> : null}
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        {step !== "review" ? (
          <Button onClick={() => setStep(nextStep(step))}>Continuar</Button>
        ) : (
          <Button onClick={confirm}>{mode === "creation" ? "Confirmar progressão" : "Confirmar subida"}</Button>
        )}
      </footer>

      <AbilityDialog
        open={abilitySource !== null}
        ability={editingAbility}
        onClose={() => {
          setAbilitySource(null)
          setEditingAbility(null)
        }}
        onSave={saveCustomAbility}
      />
    </section>
  )
}

function ManualMulticlassControls({
  classPlans,
  creationTotal,
  onAdd,
}: {
  classPlans: ProgressionClassPlan[]
  creationTotal: number
  onAdd: (className: ClassName) => void
}) {
  const available = ALL_CLASS_NAMES.filter(
    (className) => !classPlans.some((plan) => plan.className === className),
  )
  const [value, setValue] = useState<ClassName>(available[0] ?? "fighter")
  const selected = available.includes(value) ? value : available[0]
  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1.5 text-xs text-text">
          Adicionar multiclasse
          <Select value={selected ?? ""} onChange={(event) => setValue(event.target.value as ClassName)}>
            {available.map((className) => <option key={className} value={className}>{getClassProgression(className).label}</option>)}
          </Select>
        </label>
        <Button variant="secondary" disabled={!selected || classPlans.length >= creationTotal || !classPlans.some((plan) => plan.level > 1)} onClick={() => selected && onAdd(selected)}>Adicionar classe</Button>
      </div>
      <p className="mt-3 text-xs text-textMuted">Requisitos de multiclasse não são validados; consulte sua referência.</p>
    </section>
  )
}

function ManualSpellsStep({
  classPlans,
  spells,
  selections,
  queries,
  onQueryChange,
  onToggleSpell,
  onTogglePrepared,
}: {
  classPlans: ProgressionClassPlan[]
  spells: Spell[]
  selections: SpellSelectionState
  queries: Partial<Record<ClassName, string>>
  onQueryChange: (className: ClassName, value: string) => void
  onToggleSpell: (className: ClassName, spellIndex: string) => void
  onTogglePrepared: (className: ClassName, spellIndex: string) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-textH">
        Esta etapa não aplica lista de classe, nível máximo ou limite de magias. Selecione apenas o que sua referência permite. Você também pode deixar tudo vazio e cadastrar magias depois na ficha.
      </div>
      {classPlans.map((plan) => {
        const state = selections[plan.className] ?? { selected: [], prepared: [] }
        const query = normalize(queries[plan.className] ?? "")
        const visible = spells
          .filter((spell) => !query || normalize(`${spell.displayName ?? ""} ${spell.name} ${spell.school}`).includes(query))
          .toSorted((left, right) => left.slotLevel - right.slotLevel || spellName(left).localeCompare(spellName(right), "pt-BR"))
        return (
          <section key={plan.className} className="rounded-xl border border-border bg-bg-subtle p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-textH">{getClassProgression(plan.className).label}</h2>
                <p className="mt-1 text-xs text-textMuted">{state.selected.length} selecionada(s) manualmente.</p>
              </div>
              <Input value={queries[plan.className] ?? ""} placeholder="Buscar magia no compêndio" onChange={(event) => onQueryChange(plan.className, event.target.value)} />
            </div>
            <div className="mt-4 grid max-h-[36rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {visible.map((spell) => {
                const selected = state.selected.includes(spell.index)
                const prepared = state.prepared.includes(spell.index)
                return (
                  <article key={spell.index} className={selected ? "rounded-lg border border-accentBorder bg-accentBg p-3" : "rounded-lg border border-border bg-bg p-3"}>
                    <button type="button" className="w-full text-left" onClick={() => onToggleSpell(plan.className, spell.index)}>
                      <div className="font-medium text-textH">{spellName(spell)}</div>
                      <div className="mt-1 text-xs text-textMuted">{spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`} · {String(spell.school)}</div>
                    </button>
                    {selected && spell.slotLevel > 0 ? (
                      <label className="mt-3 flex items-center gap-2 text-xs text-text">
                        <input type="checkbox" checked={prepared} onChange={() => onTogglePrepared(plan.className, spell.index)} />
                        Marcar como preparada
                      </label>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function AbilityEntries({
  entries,
  onEdit,
  onRemove,
}: {
  entries: ProgressionCustomAbility[]
  onEdit: (entry: ProgressionCustomAbility) => void
  onRemove: (abilityId: string) => void
}) {
  if (!entries.length) return <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">Nenhuma característica adicionada.</div>
  return (
    <div className="mt-4 grid gap-2">
      {entries.map((entry) => (
        <article key={entry.ability.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3">
          <div>
            <div className="font-medium text-textH">{entry.ability.name}</div>
            <div className="mt-1 text-xs text-textMuted">Nível de classe {entry.classLevel ?? "—"}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEdit(entry)}>Editar</Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(entry.ability.id)}>Remover</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function createInitialPlans(
  mode: "creation" | "level-up",
  character: CharacterTemplate,
  creationTotal: number,
  primaryClassName: ClassName,
): ProgressionClassPlan[] {
  if (mode === "level-up") return createLevelUpPlans(character, primaryClassName)
  const existing = character.get("sheet").classes?.find((entry) => entry.className === primaryClassName)
  return [createPlan(
    primaryClassName,
    creationTotal,
    0,
    existing?.subclass?.id,
    existing?.subclass?.name,
    existing?.subclass?.source,
    existing?.levelChoices,
  )]
}

function createLevelUpPlans(
  character: CharacterTemplate,
  advancedClassName: ClassName,
): ProgressionClassPlan[] {
  const existing = character.get("sheet").classes ?? []
  const plans = existing.map((entry) => createPlan(
    entry.className,
    entry.level + (entry.className === advancedClassName ? 1 : 0),
    entry.level,
    entry.subclass?.id,
    entry.subclass?.name,
    entry.subclass?.source,
    entry.levelChoices,
  ))
  if (!existing.some((entry) => entry.className === advancedClassName)) {
    plans.push(createPlan(advancedClassName, 1, 0))
  }
  return plans
}

function createPlan(
  className: ClassName,
  level: number,
  previousLevel: number,
  subclassId?: string,
  subclassName?: string,
  subclassSource?: string,
  levelChoices: Record<string, string[]> = {},
): ProgressionClassPlan {
  return {
    className,
    level: Math.max(1, Math.min(20, Math.trunc(level))),
    previousLevel: Math.max(0, Math.min(20, Math.trunc(previousLevel))),
    subclassId,
    subclassName,
    subclassSource,
    levelChoices: { ...levelChoices },
    enabledOptionalFeatureIds: [],
  }
}

function createInitialSpellSelections(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): SpellSelectionState {
  const result: SpellSelectionState = {}
  const known = character.get("magic")?.spells.knownSpells ?? []
  for (const plan of plans) {
    const entries = known.filter(
      (entry) => entry.source.type === "class" && String(entry.source.sourceId ?? entry.source.name).split(":")[0] === plan.className,
    )
    result[plan.className] = {
      selected: entries.map((entry) => entry.spells.id),
      prepared: entries.filter((entry) => entry.spells.prepared).map((entry) => entry.spells.id),
    }
  }
  return result
}

function characterWithPlans(
  character: CharacterTemplate,
  plans: ProgressionClassPlan[],
): CharacterTemplate {
  return character.withSheet("classes", plans.map((plan) => {
    const existing = character.get("sheet").classes?.find((entry) => entry.className === plan.className)
    const name = plan.subclassName?.trim() || existing?.subclass?.name
    return {
      ...createClassEntry(plan.className, plan.level),
      ...existing,
      level: plan.level as never,
      subclass: name ? {
        id: plan.subclassId || existing?.subclass?.id || slug(name),
        name,
        source: plan.subclassSource?.trim() || existing?.subclass?.source || "Manual",
      } : undefined,
      levelChoices: plan.levelChoices,
    }
  }))
}

function nextStep(step: Step): Step {
  if (step === "classes") return "features"
  if (step === "features") return "spells"
  return "review"
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("en-US")
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg p-3 text-xs">
      <span className="text-textMuted">{label}</span>
      <strong className="text-right text-textH">{value}</strong>
    </div>
  )
}
''')

# ---------------------------------------------------------------------------
# Integrated creation wizard: store subclass as user-entered text.
# The existing feature/spell/proficiency panels become empty/manual because
# their rule providers above no longer ship catalogs.
# ---------------------------------------------------------------------------
path = ROOT / 'src/features/characters/creation/IntegratedCharacterCreationWizard.tsx'
text = path.read_text()
text = text.replace('"Classes, características e magias",', '"Classes e características manuais",')
text = text.replace(
    'Raça, antecedente, equipamentos, classes, características, magias e atributos são configurados antes da criação da ficha.',
    'Raça, antecedente, equipamentos e atributos são configurados aqui. Subclasse e características de classe são inseridas manualmente a partir da sua referência.',
)
text = text.replace(
    'Depois de selecionar as classes, todas as características dos níveis distribuídos serão exibidas e poderão ser revisadas antes dos atributos.',
    'Depois de selecionar as classes, consulte sua referência e cadastre manualmente as características recebidas.',
)

# Replace catalog-backed subclass selector with free text.
pattern = r'''\n            \{subclassRequired && progression\.subclasses\.length \? \(\n              <Field.*?\n            \) : null\}\n'''
replacement = '''
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Subclasse (manual)">
                <Input
                  value={plan.subclassName ?? ""}
                  placeholder="Digite conforme sua referência"
                  onChange={(event) =>
                    onUpdatePlan(plan.className, (current) => ({
                      ...current,
                      subclassName: event.target.value,
                      subclassId: undefined,
                    }))
                  }
                />
              </Field>
              <Field label="Fonte / livro (opcional)">
                <Input
                  value={plan.subclassSource ?? ""}
                  placeholder="Sua referência"
                  onChange={(event) =>
                    onUpdatePlan(plan.className, (current) => ({
                      ...current,
                      subclassSource: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
'''
text, changed = re.subn(pattern, '\n' + replacement, text, count=1, flags=re.S)
if changed != 1:
    raise SystemExit('Could not replace integrated subclass selector')
text = re.sub(r'\n\s*const subclassRequired = plan\.level >= progression\.subclassLevel\n', '\n', text, count=1)

# Manual subclass persistence in createCharacter.
text = re.sub(
    r'''const classes = classPlans\.map\(\(plan\) => \{\n\s*const subclass = getClassProgression\(\n\s*plan\.className,\n\s*\)\.subclasses\.find\(\(entry\) => entry\.id === plan\.subclassId\)\n\s*return \{\n\s*\.\.\.createClassEntry\(plan\.className, plan\.level\),\n\s*subclass: subclass\n\s*\? \{ id: subclass\.id, name: subclass\.name, source: subclass\.source \}\n\s*: undefined,\n\s*levelChoices: plan\.levelChoices,\n\s*\}\n\s*\}\)''',
    '''const classes = classPlans.map((plan) => ({
      ...createClassEntry(plan.className, plan.level),
      subclass: manualSubclass(plan),
      levelChoices: plan.levelChoices,
    }))''',
    text,
    count=1,
    flags=re.S,
)

# Manual subclass persistence in draft character.
text = re.sub(
    r'''classes: classPlans\.map\(\(plan\) => \{\n\s*const subclass = getClassProgression\(\n\s*plan\.className,\n\s*\)\.subclasses\.find\(\(entry\) => entry\.id === plan\.subclassId\)\n\s*return \{\n\s*\.\.\.createClassEntry\(plan\.className, plan\.level\),\n\s*subclass: subclass\n\s*\? \{ id: subclass\.id, name: subclass\.name, source: subclass\.source \}\n\s*: undefined,\n\s*levelChoices: plan\.levelChoices,\n\s*\}\n\s*\}\),''',
    '''classes: classPlans.map((plan) => ({
          ...createClassEntry(plan.className, plan.level),
          subclass: manualSubclass(plan),
          levelChoices: plan.levelChoices,
        })),''',
    text,
    count=1,
    flags=re.S,
)

# Manual-oriented copy in class features panel.
text = text.replace(
    'Características dos níveis 1–{plan.level}',
    'Características da classe — entrada manual',
)
text = text.replace(
    'title="Características personalizadas desta classe"',
    'title="Características desta classe"',
)

# Add helper near createPlan.
needle = 'function createPlan(className: ClassName, level: number): ProgressionClassPlan {'
helper = '''function manualSubclass(plan: ProgressionClassPlan) {
  const name = plan.subclassName?.trim()
  if (!name) return undefined
  return {
    id: plan.subclassId || slugManual(name),
    name,
    source: plan.subclassSource?.trim() || "Manual",
  }
}

function slugManual(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

'''
if needle not in text:
    raise SystemExit('Could not locate integrated createPlan')
text = text.replace(needle, helper + needle, 1)
path.write_text(text)

# ---------------------------------------------------------------------------
# Remove progression-specific DOM bridges/enhancers from wrapper and sanitize
# the now-unused modules themselves.
# ---------------------------------------------------------------------------
wrapper = ROOT / 'src/features/characters/creation/characterCreationWizard.tsx'
wrapper_text = wrapper.read_text()
for import_block in [
    'import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"\n',
    'import { ProgressionModalSelectionSync } from "../progression/bridges/ProgressionModalSelectionSync"\n',
    'import { ProgressionSpellSelectionModal } from "../progression/ProgressionSpellSelectionModal"\n',
    'import { CreationSpellGrantLocalizationBridge } from "./bridges/CreationSpellGrantLocalizationBridge"\n',
]:
    wrapper_text = wrapper_text.replace(import_block, '')
for component in [
    '      <CreationSpellGrantLocalizationBridge />\n',
    '      <ProgressionFeatureModalEnhancer />\n',
    '      <ProgressionModalSelectionSync />\n',
    '      <ProgressionSpellSelectionModal />\n',
]:
    wrapper_text = wrapper_text.replace(component, '')
wrapper.write_text(wrapper_text)

# Files that existed only to encode bundled progression rules/descriptions.
for file_path in [
    'src/models/leveling/ProgressionAdditionalLocalization.ts',
    'src/models/leveling/ProgressionLocalization.ts',
    'src/models/leveling/SubclassLocalization.ts',
    'src/models/leveling/ProgressionFeatureMechanics.ts',
    'src/models/leveling/ProgressionFeatureMechanicsAdditional.ts',
    'src/models/leveling/ProgressionFeatureFinalization.ts',
    'src/models/leveling/refreshProgressionFeatureMechanics.ts',
    'src/lib/characterProgression/finalizeDynamicSubclassSpells.ts',
    'src/features/characters/progression/ProgressionFeatureDescriptionSync.tsx',
    'src/features/characters/progression/bridges/ProgressionModalSelectionSync.tsx',
    'src/features/characters/progression/ProgressionFeatureModalEnhancer.tsx',
    'src/features/characters/progression/ProgressionSpellSelectionModal.tsx',
    'src/features/characters/creation/bridges/CreationSpellGrantLocalizationBridge.tsx',
]:
    target = ROOT / file_path
    if target.exists():
        target.unlink()

# Guard against accidentally keeping the removed bundled catalog or its
# known runtime bridges. Build will catch ordinary stale imports; this check
# catches hidden/static remnants too.
forbidden_tokens = [
    'classProgression/classes/',
    'SUBCLASS_SPELL_GRANTS',
    'LAND_SPELLS',
    'GENIE_SPELLS',
    'ProgressionFeatureMechanics',
    'ProgressionAdditionalLocalization',
    'SubclassLocalization',
    'ProgressionFeatureDescriptionSync',
]
leftovers = []
for target in (ROOT / 'src').rglob('*'):
    if not target.is_file() or target.suffix not in {'.ts', '.tsx', '.md'}:
        continue
    text = target.read_text()
    for token in forbidden_tokens:
        if token in text:
            leftovers.append(f'{target}: {token}')
if leftovers:
    raise SystemExit('Bundled progression remnants remain:\n' + '\n'.join(leftovers))
