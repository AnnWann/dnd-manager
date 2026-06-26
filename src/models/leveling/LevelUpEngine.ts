import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { synchronizeSorceryPointPool } from "../characters/characterSorceryPoints"
import type { MetamagicId } from "../magic/metamagic/Metamagic"
import type { Spell } from "../magic/spells/Spell"
import type { MagicCircleLevel } from "../magic/spells/spellDefinitions"
import type { Attribute } from "../sheet/Attribute"
import {
  CharacterClassBuilder,
  type CharacterClassInterface,
  type CharacterSubclassSelection,
  type ClassLevel,
  type ClassName,
  type KnownSpellsRule,
} from "../sheet/Class"
import type { Skill } from "../sheet/Skills"
import {
  getCantripsKnownAtLevel,
  getClassProgression,
  getFeaturesAtLevel,
  type ClassProgressionDefinition,
  type LevelChoiceDefinition,
  type LevelFeatureDefinition,
  type SubclassDefinition,
} from "./ClassProgression"

export type LevelUpSpellRequirement = {
  id: string
  label: string
  count: number
  maxLevel: number
  exactLevel?: number
  cantrip?: boolean
  anyClass?: boolean
  classFilter?: ClassName
  existingOnly?: boolean
  schools?: string[]
  note?: string
}

export type LevelUpPlan = {
  className: ClassName
  classIndex: number | null
  currentClassLevel: number
  nextClassLevel: number
  currentTotalLevel: number
  nextTotalLevel: number
  progression: ClassProgressionDefinition
  subclassRequired: boolean
  selectedSubclass?: SubclassDefinition
  features: LevelFeatureDefinition[]
  choices: LevelChoiceDefinition[]
  spellRequirements: LevelUpSpellRequirement[]
  averageHpGain: number
  multiclassEntry: boolean
}

export type AbilityScoreSelection = {
  mode: "attributes" | "feat"
  increases: Partial<Record<Attribute, number>>
  featName: string
  featDescription: string
}

export type LevelUpSelections = {
  className: ClassName
  subclassId?: string
  optionalFeatureIds: string[]
  choices: Record<string, string[]>
  spellChoices: Record<string, string[]>
  hpGain: number
  abilityScore?: AbilityScoreSelection
}

const THIRD_CASTER_SPELLS: Partial<Record<number, number>> = {
  3: 3,
  4: 4,
  7: 5,
  8: 6,
  10: 7,
  11: 8,
  13: 9,
  14: 10,
  16: 11,
  19: 12,
  20: 13,
}

const THIRD_CASTER_CANTRIPS: Partial<Record<"eldritch-knight" | "arcane-trickster", Partial<Record<number, number>>>> = {
  "eldritch-knight": { 3: 2, 10: 3 },
  "arcane-trickster": { 3: 3, 10: 4 },
}

export function getLevelUpPlan(
  character: CharacterTemplate,
  className: ClassName,
  subclassId?: string,
): LevelUpPlan {
  const classes = character.get("sheet").classes ?? []
  const classIndex = classes.findIndex((entry) => entry.className === className)
  const existingClass = classIndex >= 0 ? classes[classIndex] : undefined
  const currentClassLevel = existingClass?.level ?? 0
  const nextClassLevel = Math.min(20, currentClassLevel + 1)
  const currentTotalLevel = classes.reduce(
    (total, entry) => total + Math.max(0, Number(entry.level) || 0),
    0,
  )
  const progression = getClassProgression(className)
  const effectiveSubclassId =
    existingClass?.subclass?.id ?? subclassId
  const selectedSubclass = progression.subclasses.find(
    (entry) => entry.id === effectiveSubclassId,
  )
  const features = getFeaturesAtLevel(
    className,
    nextClassLevel,
    selectedSubclass?.id,
  )
  const choices = features.flatMap((feature) =>
    feature.choice ? [feature.choice] : [],
  )
  const conModifier = character.getEffectiveAttributeModifier("con")
  const averageDie = averageHitDie(progression.hitDie)

  return {
    className,
    classIndex: classIndex >= 0 ? classIndex : null,
    currentClassLevel,
    nextClassLevel,
    currentTotalLevel,
    nextTotalLevel: currentTotalLevel + 1,
    progression,
    subclassRequired:
      nextClassLevel >= progression.subclassLevel &&
      !existingClass?.subclass,
    selectedSubclass,
    features,
    choices,
    spellRequirements: getSpellRequirements(
      character,
      className,
      currentClassLevel,
      nextClassLevel,
      selectedSubclass?.id,
    ),
    averageHpGain: Math.max(1, averageDie + conModifier),
    multiclassEntry: currentClassLevel === 0 && currentTotalLevel > 0,
  }
}

export function validateLevelUpSelections(
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): string[] {
  const errors: string[] = []

  if (plan.nextTotalLevel > 20) {
    errors.push("O nível total não pode ultrapassar 20.")
  }

  if (plan.currentClassLevel >= 20) {
    errors.push("Essa classe já está no nível 20.")
  }

  if (plan.subclassRequired && !selections.subclassId) {
    errors.push("Escolha uma subclasse antes de concluir.")
  }

  for (const feature of plan.features) {
    if (feature.optional && !selections.optionalFeatureIds.includes(feature.id)) {
      continue
    }

    const choice = feature.choice
    if (!choice) continue

    if (choice.kind === "asi") {
      if (!selections.abilityScore) {
        errors.push("Escolha um aumento de atributo ou talento.")
      }
      continue
    }

    const values = selections.choices[choice.id] ?? []
    if (values.length !== choice.count) {
      errors.push(
        `${choice.label}: escolha ${choice.count} opção${choice.count === 1 ? "" : "ões"}.`,
      )
    }
  }

  for (const requirement of plan.spellRequirements) {
    const values = selections.spellChoices[requirement.id] ?? []
    if (values.length !== requirement.count) {
      errors.push(
        `${requirement.label}: escolha ${requirement.count} magia${requirement.count === 1 ? "" : "s"}.`,
      )
    }
  }

  if (!Number.isFinite(selections.hpGain) || selections.hpGain < 1) {
    errors.push("O ganho de pontos de vida deve ser pelo menos 1.")
  }

  if (selections.abilityScore?.mode === "attributes") {
    const total = Object.values(selections.abilityScore.increases).reduce(
      (sum, value) => sum + Math.max(0, Number(value) || 0),
      0,
    )
    if (total !== 2) {
      errors.push("O aumento de atributos deve distribuir exatamente 2 pontos.")
    }
  }

  if (
    selections.abilityScore?.mode === "feat" &&
    !selections.abilityScore.featName.trim()
  ) {
    errors.push("Informe o nome do talento escolhido.")
  }

  return errors
}

export function applyLevelUp(
  character: CharacterTemplate,
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): CharacterTemplate {
  const errors = validateLevelUpSelections(plan, selections)
  if (errors.length) throw new Error(errors.join("\n"))

  const existingClasses = character.get("sheet").classes ?? []
  const existingClass =
    plan.classIndex === null ? undefined : existingClasses[plan.classIndex]
  const chosenSubclass = plan.progression.subclasses.find(
    (entry) => entry.id === selections.subclassId,
  )
  const subclassSelection: CharacterSubclassSelection | undefined =
    existingClass?.subclass ??
    (chosenSubclass
      ? {
          id: chosenSubclass.id,
          name: chosenSubclass.name,
          source: chosenSubclass.source,
        }
      : undefined)
  const mergedChoices = {
    ...(existingClass?.levelChoices ?? {}),
    ...selections.choices,
    ...selections.spellChoices,
  }
  const nextClass = createClassEntry(
    plan.className,
    plan.nextClassLevel as ClassLevel,
    existingClass,
    subclassSelection,
    mergedChoices,
  )
  const nextClasses =
    plan.classIndex === null
      ? [...existingClasses, nextClass]
      : existingClasses.map((entry, index) =>
          index === plan.classIndex ? nextClass : entry,
        )

  let next = character.withSheet("classes", nextClasses)
  next = applyHpGain(next, plan, selections.hpGain)
  next = applyFeatureAbilities(next, plan, selections)
  next = applyChoiceEffects(next, plan, selections)
  next = applySelectedSpells(next, plan, selections)
  next = next.ensureMagic().syncMagicWithClasses()
  next = synchronizeSorceryPointPool(next)

  return next
}

export function spellMatchesRequirement(
  spell: Spell,
  requirement: LevelUpSpellRequirement,
  character: CharacterTemplate,
): boolean {
  if (requirement.existingOnly) {
    const known = character.get("magic")?.spells.knownSpells.some(
      (entry) => entry.spells.id === spell.index,
    )
    if (!known) return false
  }

  if (requirement.cantrip && spell.slotLevel !== 0) return false
  if (!requirement.cantrip && spell.slotLevel === 0) return false
  if (requirement.exactLevel !== undefined && spell.slotLevel !== requirement.exactLevel) {
    return false
  }
  if (spell.slotLevel > requirement.maxLevel) return false
  if (
    !requirement.anyClass &&
    requirement.classFilter &&
    !spell.classes.includes(requirement.classFilter)
  ) {
    return false
  }
  if (
    requirement.schools?.length &&
    !requirement.schools.some(
      (school) => school.toLowerCase() === String(spell.school).toLowerCase(),
    )
  ) {
    return false
  }

  return true
}

function getSpellRequirements(
  character: CharacterTemplate,
  className: ClassName,
  currentLevel: number,
  nextLevel: number,
  subclassId?: string,
): LevelUpSpellRequirement[] {
  const requirements: LevelUpSpellRequirement[] = []
  const currentCantrips = getCantripsKnownAtLevel(className, currentLevel)
  const nextCantrips = getCantripsKnownAtLevel(className, nextLevel)

  if (nextCantrips > currentCantrips) {
    requirements.push({
      id: `${className}-cantrips-${nextLevel}`,
      label: "Novos truques",
      count: nextCantrips - currentCantrips,
      maxLevel: 0,
      cantrip: true,
      classFilter: className,
    })
  }

  const currentClass = createClassEntry(
    className,
    Math.max(1, currentLevel) as ClassLevel,
  )
  const nextClass = createClassEntry(
    className,
    nextLevel as ClassLevel,
  )
  const currentKnown = currentLevel > 0
    ? getKnownSpellLimit(currentClass.knownSpells, currentLevel)
    : 0
  const nextKnown = getKnownSpellLimit(nextClass.knownSpells, nextLevel)

  if (nextClass.knownSpells?.mode === "limited" && nextKnown > currentKnown) {
    requirements.push({
      id: `${className}-known-spells-${nextLevel}`,
      label: "Novas magias conhecidas",
      count: nextKnown - currentKnown,
      maxLevel: getMaximumSpellLevel(className, nextLevel),
      classFilter: className,
    })
  }

  if (className === "wizard") {
    requirements.push({
      id: `wizard-spellbook-${nextLevel}`,
      label: nextLevel === 1
        ? "Magias iniciais do grimório"
        : "Magias adicionadas ao grimório",
      count: nextLevel === 1 ? 6 : 2,
      maxLevel: getMaximumSpellLevel(className, nextLevel),
      classFilter: "wizard",
    })
  }

  if (
    className === "bard" &&
    ([10, 14, 18].includes(nextLevel) ||
      (subclassId === "lore" && nextLevel === 6))
  ) {
    requirements.push({
      id: `bard-magical-secrets-${nextLevel}`,
      label: "Magical Secrets",
      count: 2,
      maxLevel: getMaximumSpellLevel("bard", nextLevel),
      anyClass: true,
    })
  }

  if (className === "warlock") {
    const arcanumLevel: Partial<Record<number, number>> = {
      11: 6,
      13: 7,
      15: 8,
      17: 9,
    }
    const exactLevel = arcanumLevel[nextLevel]
    if (exactLevel) {
      requirements.push({
        id: `warlock-arcanum-${exactLevel}`,
        label: `Mystic Arcanum de ${exactLevel}º nível`,
        count: 1,
        maxLevel: exactLevel,
        exactLevel,
        classFilter: "warlock",
      })
    }
  }

  if (className === "wizard" && nextLevel === 18) {
    requirements.push(
      {
        id: "wizard-spell-mastery-1",
        label: "Spell Mastery — magia de 1º nível",
        count: 1,
        maxLevel: 1,
        exactLevel: 1,
        classFilter: "wizard",
        existingOnly: true,
      },
      {
        id: "wizard-spell-mastery-2",
        label: "Spell Mastery — magia de 2º nível",
        count: 1,
        maxLevel: 2,
        exactLevel: 2,
        classFilter: "wizard",
        existingOnly: true,
      },
    )
  }

  if (className === "wizard" && nextLevel === 20) {
    requirements.push({
      id: "wizard-signature-spells",
      label: "Signature Spells",
      count: 2,
      maxLevel: 3,
      exactLevel: 3,
      classFilter: "wizard",
      existingOnly: true,
    })
  }

  if (
    (className === "fighter" && subclassId === "eldritch-knight") ||
    (className === "rogue" && subclassId === "arcane-trickster")
  ) {
    const subclassKey = subclassId as "eldritch-knight" | "arcane-trickster"
    const currentSubclassCantrips = getThresholdValue(
      THIRD_CASTER_CANTRIPS[subclassKey],
      currentLevel,
    )
    const nextSubclassCantrips = getThresholdValue(
      THIRD_CASTER_CANTRIPS[subclassKey],
      nextLevel,
    )
    if (nextSubclassCantrips > currentSubclassCantrips) {
      requirements.push({
        id: `${subclassKey}-cantrips-${nextLevel}`,
        label: "Truques da subclasse",
        count: nextSubclassCantrips - currentSubclassCantrips,
        maxLevel: 0,
        cantrip: true,
        classFilter: "wizard",
        note:
          subclassKey === "arcane-trickster"
            ? "Mage Hand faz parte da progressão do Arcane Trickster."
            : undefined,
      })
    }

    const currentSubclassSpells = getThresholdValue(
      THIRD_CASTER_SPELLS,
      currentLevel,
    )
    const nextSubclassSpells = getThresholdValue(
      THIRD_CASTER_SPELLS,
      nextLevel,
    )
    if (nextSubclassSpells > currentSubclassSpells) {
      const unrestricted = [3, 8, 14, 20].includes(nextLevel)
      requirements.push({
        id: `${subclassKey}-spells-${nextLevel}`,
        label: "Magias da subclasse",
        count: nextSubclassSpells - currentSubclassSpells,
        maxLevel: getMaximumSpellLevel(className, nextLevel, subclassId),
        classFilter: "wizard",
        schools: unrestricted
          ? undefined
          : subclassKey === "eldritch-knight"
            ? ["abjuration", "evocation"]
            : ["enchantment", "illusion"],
        note: unrestricted
          ? "Este nível permite uma magia de qualquer escola da lista de mago."
          : "A escola da magia é limitada pela subclasse neste nível.",
      })
    }
  }

  return requirements
}

function applyHpGain(
  character: CharacterTemplate,
  plan: LevelUpPlan,
  hpGain: number,
): CharacterTemplate {
  const hp = character.get("sheet").HP
  const roundedGain = Math.max(1, Math.trunc(hpGain))
  const die = plan.progression.hitDie
  const currentHitDie = hp.hitDice[die]
  const nextHitDice = {
    ...hp.hitDice,
    [die]: {
      max: {
        quantity: (currentHitDie?.max.quantity ?? 0) + 1,
        sides: die,
      },
      current: {
        quantity: (currentHitDie?.current.quantity ?? 0) + 1,
        sides: die,
      },
    },
  }

  return character.withSheet("HP", {
    ...hp,
    max: hp.max + roundedGain,
    current: hp.current + roundedGain,
    hitDice: nextHitDice,
  })
}

function applyFeatureAbilities(
  character: CharacterTemplate,
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): CharacterTemplate {
  let next = character

  for (const feature of plan.features) {
    if (feature.optional && !selections.optionalFeatureIds.includes(feature.id)) {
      continue
    }

    const selectedValues = feature.choice
      ? selections.choices[feature.choice.id] ?? []
      : []
    const description = [
      `${plan.progression.label} nível ${plan.nextClassLevel}.`,
      `Fonte: ${feature.source}.`,
      feature.optional ? "Característica opcional selecionada." : "",
      selectedValues.length
        ? `Escolha: ${selectedValues.join(", ")}.`
        : "",
      feature.description ?? "",
    ]
      .filter(Boolean)
      .join(" ")

    next = addAbilityUnlessPresent(next, {
      id: `level:${plan.className}:${plan.nextClassLevel}:${feature.id}`,
      name: feature.name,
      description,
      kind: "passive",
      category:
        feature.choice?.kind === "invocation"
          ? "invocation"
          : feature.choice?.kind === "asi" &&
              selections.abilityScore?.mode === "feat"
            ? "feat"
            : "general",
    })
  }

  return next
}

function applyChoiceEffects(
  character: CharacterTemplate,
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): CharacterTemplate {
  let next = character

  for (const feature of plan.features) {
    if (feature.optional && !selections.optionalFeatureIds.includes(feature.id)) {
      continue
    }

    const choice = feature.choice
    if (!choice) continue

    if (choice.kind === "asi") {
      next = applyAbilityScoreSelection(next, selections.abilityScore)
      continue
    }

    const values = selections.choices[choice.id] ?? []

    if (choice.kind === "expertise") {
      const skills = { ...next.get("sheet").skills }
      for (const skill of values as Skill[]) skills[skill] = "expertise"
      next = next.withSheet("skills", skills)
      continue
    }

    if (choice.kind === "metamagic") {
      for (const value of values) {
        next = next.addMetamagic(value as MetamagicId)
      }
      continue
    }

    for (const value of values) {
      next = addAbilityUnlessPresent(next, {
        id: `choice:${plan.className}:${choice.id}:${slug(value)}`,
        name: value,
        description: `${choice.label}. Escolha registrada no nível ${plan.nextClassLevel} de ${plan.progression.label}.`,
        kind: "passive",
        category: choice.kind === "invocation" ? "invocation" : "general",
      })
    }
  }

  return next
}

function applyAbilityScoreSelection(
  character: CharacterTemplate,
  selection: AbilityScoreSelection | undefined,
): CharacterTemplate {
  if (!selection) return character

  if (selection.mode === "feat") {
    return addAbilityUnlessPresent(character, {
      id: `feat:${slug(selection.featName)}:${crypto.randomUUID()}`,
      name: selection.featName.trim(),
      description:
        selection.featDescription.trim() ||
        "Talento escolhido durante um aumento de atributo.",
      kind: "passive",
      category: "feat",
    })
  }

  const attributes = { ...character.get("sheet").attributes }
  for (const [attribute, increase] of Object.entries(selection.increases)) {
    const key = attribute as Attribute
    attributes[key] = Math.min(
      30,
      Math.max(1, attributes[key] + Math.max(0, Number(increase) || 0)),
    )
  }

  return character.withSheet("attributes", attributes)
}

function applySelectedSpells(
  character: CharacterTemplate,
  plan: LevelUpPlan,
  selections: LevelUpSelections,
): CharacterTemplate {
  let next = character
  const nextClass = (next.get("sheet").classes ?? []).find(
    (entry) => entry.className === plan.className,
  )

  for (const requirement of plan.spellRequirements) {
    if (requirement.existingOnly) continue

    for (const spellIndex of selections.spellChoices[requirement.id] ?? []) {
      next = next.addSpell({
        source: {
          type: "class",
          name: plan.className,
          sourceId: nextClass?.subclass?.id
            ? `${plan.className}:${nextClass.subclass.id}`
            : plan.className,
          attribute: nextClass?.castingAttribute ?? castingAttributeFor(plan.className),
        },
        spells: {
          id: spellIndex,
          prepared:
            requirement.cantrip === true ||
            nextClass?.knownSpells?.mode === "limited" ||
            plan.className === "warlock",
        },
      })
    }
  }

  return next
}

function createClassEntry(
  className: ClassName,
  level: ClassLevel,
  existing?: CharacterClassInterface,
  subclass?: CharacterSubclassSelection,
  levelChoices?: Record<string, string[]>,
): CharacterClassInterface {
  const builder = new CharacterClassBuilder()
  const base = builder[className]()

  return {
    ...base,
    ...existing,
    className,
    level,
    castingAttribute: existing?.castingAttribute ?? base.castingAttribute,
    spellcastingProgression:
      existing?.spellcastingProgression ?? base.spellcastingProgression,
    knownSpells: existing?.knownSpells ?? base.knownSpells,
    subclass: subclass ?? existing?.subclass,
    levelChoices: levelChoices ?? existing?.levelChoices,
  }
}

function getKnownSpellLimit(
  rule: KnownSpellsRule | undefined,
  level: number,
): number {
  if (!rule) return 0
  const override = rule.overrides?.[level as ClassLevel]
  if (override !== undefined) return override
  return rule.baseAtLevel1 + Math.max(0, level - 1) * rule.perLevel
}

function getMaximumSpellLevel(
  className: ClassName,
  level: number,
  subclassId?: string,
): number {
  if (className === "warlock") return Math.min(5, Math.ceil(level / 2))
  if (
    (className === "fighter" && subclassId === "eldritch-knight") ||
    (className === "rogue" && subclassId === "arcane-trickster")
  ) {
    return Math.min(4, Math.ceil(level / 6))
  }
  if (className === "artificer") {
    return Math.min(5, Math.max(1, Math.floor((level + 3) / 4)))
  }
  if (className === "paladin" || className === "ranger") {
    return level < 2 ? 0 : Math.min(5, Math.floor((level + 3) / 4))
  }
  return Math.min(9, Math.ceil(level / 2))
}

function getThresholdValue(
  progression: Partial<Record<number, number>> | undefined,
  level: number,
): number {
  return Object.entries(progression ?? {})
    .map(([minimum, value]) => [Number(minimum), value] as const)
    .filter(([minimum]) => minimum <= level)
    .toSorted((left, right) => left[0] - right[0])
    .at(-1)?.[1] ?? 0
}

function averageHitDie(side: string): number {
  const numeric = Number(side.replace("d", ""))
  return Math.floor(numeric / 2) + 1
}

function castingAttributeFor(className: ClassName): Attribute {
  if (className === "wizard" || className === "artificer") return "int"
  if (
    className === "cleric" ||
    className === "druid" ||
    className === "ranger"
  ) {
    return "wis"
  }
  return "cha"
}

function addAbilityUnlessPresent(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  if (character.get("abilities")?.some((entry) => entry.id === ability.id)) {
    return character
  }
  return character.addAbility(ability)
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function levelUpRequirementSpellLabel(
  requirement: LevelUpSpellRequirement,
): string {
  const level = requirement.cantrip
    ? "truque"
    : requirement.exactLevel !== undefined
      ? `${requirement.exactLevel}º nível`
      : `até ${requirement.maxLevel}º nível`
  return `${requirement.label} — ${level}`
}

export function asMagicCircleLevel(level: number): MagicCircleLevel {
  return Math.max(0, Math.min(9, Math.trunc(level))) as MagicCircleLevel
}
