import "./ExpandedClassProgression"

import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Spell } from "../magic/spells/Spell"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import {
  applyLevelUp as applyBaseLevelUp,
  getLevelUpPlan as getBaseLevelUpPlan,
  spellMatchesRequirement as spellMatchesBaseRequirement,
  validateLevelUpSelections as validateBaseLevelUpSelections,
  type LevelUpPlan,
  type LevelUpSelections,
  type LevelUpSpellRequirement,
} from "./LevelUpEngine"
import {
  getClassNamePt,
  getSubclassNamePt,
} from "./ClassLocalization"
import {
  FIGHTING_STYLES,
  WARLOCK_INVOCATIONS,
  type LevelChoiceDefinition,
  type LevelFeatureDefinition,
  type SubclassDefinition,
} from "./ClassProgression"
import {
  getChoiceLabelPt,
  getChoiceOptionPt,
  getFeatureNamePt,
} from "./FeatureLocalization"
import {
  checkMulticlassRequirements,
  type MulticlassRequirementResult,
} from "./MulticlassRequirements"
import {
  choiceAbilityId,
  synchronizeClassFeatures,
} from "./ClassFeatureSynchronization"

export * from "./LevelUpEngine"

const FLEX_PREFIX = "flex:"
const ASI_LEVELS = new Set([4, 8, 12, 16, 19])

export type ExpandedLevelUpPlan = LevelUpPlan & {
  multiclassRequirements: MulticlassRequirementResult
}

export function getLevelUpPlan(
  character: CharacterTemplate,
  className: ClassName,
  subclassId?: string,
): ExpandedLevelUpPlan {
  const normalizedCharacter = synchronizeClassFeatures(character)
  const base = getBaseLevelUpPlan(
    normalizedCharacter,
    className,
    subclassId,
  )
  const localizedSubclasses = base.progression.subclasses.map(
    localizeSubclass,
  )
  const selectedSubclass = base.selectedSubclass
    ? localizeSubclass(base.selectedSubclass)
    : undefined
  const localizedFeatures = base.features.map(localizeFeature)
  const flexibilityFeatures = getFlexibilityFeatures(
    normalizedCharacter,
    className,
    base.nextClassLevel,
  )
  const conModifier = normalizedCharacter.getEffectiveAttributeModifier("con")
  const firstLevelHp =
    base.nextTotalLevel === 1
      ? Math.max(
          1,
          Number(base.progression.hitDie.replace("d", "")) + conModifier,
        )
      : base.averageHpGain
  const features = [...localizedFeatures, ...flexibilityFeatures]

  return {
    ...base,
    progression: {
      ...base.progression,
      label: getClassNamePt(className),
      subclasses: localizedSubclasses,
    },
    selectedSubclass,
    features,
    choices: features.flatMap((feature) =>
      feature.choice ? [feature.choice] : [],
    ),
    spellRequirements: [
      ...base.spellRequirements,
      ...getSpellReplacementRequirements(
        normalizedCharacter,
        className,
        base.currentClassLevel,
        base.nextClassLevel,
        selectedSubclass?.id,
      ),
    ],
    averageHpGain: firstLevelHp,
    multiclassRequirements: checkMulticlassRequirements(
      normalizedCharacter,
      className,
    ),
  }
}

export function validateLevelUpSelections(
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
): string[] {
  const errors = validateBaseLevelUpSelections(
    stripFlexibilityFromPlan(plan),
    stripFlexibilityFromSelections(selections),
  )

  validateSpellReplacementPair(
    plan,
    selections,
    "spell",
    "Substituição de magia",
    errors,
  )
  validateSpellReplacementPair(
    plan,
    selections,
    "cantrip",
    "Substituição de truque",
    errors,
  )
  validateChoiceReplacement(
    plan,
    selections,
    "invocation",
    "Substituição de evocação",
    errors,
  )
  validateChoiceReplacement(
    plan,
    selections,
    "fighting-style",
    "Substituição de estilo de luta",
    errors,
  )

  if (
    plan.multiclassRequirements.isMulticlassEntry &&
    !plan.multiclassRequirements.allowed
  ) {
    for (const failure of plan.multiclassRequirements.failures) {
      errors.push(
        `Multiclasse bloqueada: ${failure.classLabel} exige ${failure.requirement}.`,
      )
    }
  }

  return Array.from(new Set(errors))
}

export function applyLevelUp(
  character: CharacterTemplate,
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
): CharacterTemplate {
  const errors = validateLevelUpSelections(plan, selections)
  if (errors.length) throw new Error(errors.join("\n"))

  let next = applyBaseLevelUp(
    character,
    stripFlexibilityFromPlan(plan),
    stripFlexibilityFromSelections(selections),
  )

  next = applySpellReplacement(next, plan, selections, "spell")
  next = applySpellReplacement(next, plan, selections, "cantrip")
  next = applyChoiceReplacement(
    next,
    plan,
    selections,
    "invocation",
  )
  next = applyChoiceReplacement(
    next,
    plan,
    selections,
    "fighting-style",
  )

  return synchronizeClassFeatures(next)
}

export function spellMatchesRequirement(
  spell: Spell,
  requirement: LevelUpSpellRequirement,
  character: CharacterTemplate,
): boolean {
  const normalizedSpell: Spell = {
    ...spell,
    classes: Array.isArray(spell.classes)
      ? spell.classes.filter(isClassName)
      : [],
  }

  return spellMatchesBaseRequirement(
    normalizedSpell,
    requirement,
    character,
  )
}

export function homebrewMatchesRequirementWithoutClass(
  spell: Spell,
  requirement: LevelUpSpellRequirement,
  character: CharacterTemplate,
): boolean {
  if (!spell.homebrew) return false

  if (requirement.existingOnly) {
    const known = character.get("magic")?.spells.knownSpells.some(
      (entry) => entry.spells.id === spell.index,
    )
    if (!known) return false
  }

  if (requirement.cantrip && spell.slotLevel !== 0) return false
  if (!requirement.cantrip && spell.slotLevel === 0) return false
  if (
    requirement.exactLevel !== undefined &&
    spell.slotLevel !== requirement.exactLevel
  ) {
    return false
  }
  if (spell.slotLevel > requirement.maxLevel) return false
  if (
    requirement.schools?.length &&
    !requirement.schools.some(
      (school) =>
        school.toLowerCase() === String(spell.school).toLowerCase(),
    )
  ) {
    return false
  }

  return true
}

function getSpellReplacementRequirements(
  character: CharacterTemplate,
  className: ClassName,
  currentLevel: number,
  nextLevel: number,
  subclassId?: string,
): LevelUpSpellRequirement[] {
  const requirements: LevelUpSpellRequirement[] = []
  const classFilter = thirdCasterWizardList(className, subclassId)
    ? "wizard"
    : className
  const maximumLevel = getMaximumSpellLevel(
    className,
    nextLevel,
    subclassId,
  )
  const knownSpellIds = character.get("magic")?.spells.knownSpells ?? []
  const hasLeveledSpell = knownSpellIds.some(
    (entry) => !entry.spells.id.startsWith("cantrip:"),
  )
  const hasCantrip = knownSpellIds.some((entry) => {
    const id = entry.spells.id.toLowerCase()
    return id.startsWith("cantrip:") || id.includes("cantrip")
  })

  if (
    currentLevel > 0 &&
    canReplaceKnownSpell(className, subclassId) &&
    maximumLevel > 0 &&
    hasLeveledSpell
  ) {
    requirements.push(
      {
        id: flexSpellId("spell", "forget", className, nextLevel),
        label: "Substituir magia conhecida (opcional) — remover",
        count: 1,
        maxLevel: 9,
        existingOnly: true,
        classFilter,
        note: "Escolha uma magia conhecida para remover e, no cartão seguinte, a substituta. Deixe ambos vazios para não trocar.",
      },
      {
        id: flexSpellId("spell", "learn", className, nextLevel),
        label: "Substituir magia conhecida (opcional) — aprender",
        count: 1,
        maxLevel: maximumLevel,
        classFilter,
        note: "A nova magia deve ser válida para a classe e para o nível atual.",
      },
    )
  }

  if (
    currentLevel > 0 &&
    ASI_LEVELS.has(nextLevel) &&
    canReplaceCantrip(className) &&
    hasCantrip
  ) {
    requirements.push(
      {
        id: flexSpellId("cantrip", "forget", className, nextLevel),
        label: "Versatilidade de truque (opcional) — remover",
        count: 1,
        maxLevel: 0,
        cantrip: true,
        existingOnly: true,
        classFilter,
        note: "Escolha um truque conhecido e, no cartão seguinte, o novo truque. Deixe ambos vazios para manter os atuais.",
      },
      {
        id: flexSpellId("cantrip", "learn", className, nextLevel),
        label: "Versatilidade de truque (opcional) — aprender",
        count: 1,
        maxLevel: 0,
        cantrip: true,
        classFilter,
      },
    )
  }

  return requirements
}

function getFlexibilityFeatures(
  character: CharacterTemplate,
  className: ClassName,
  nextLevel: number,
): LevelFeatureDefinition[] {
  const features: LevelFeatureDefinition[] = []

  if (className === "warlock" && nextLevel >= 3) {
    const current = currentInvocations(character)
    const additions = WARLOCK_INVOCATIONS.filter(
      (invocation) => !current.includes(invocation),
    )

    if (current.length && additions.length) {
      features.push({
        id: flexChoiceFeatureId("invocation", className, nextLevel),
        name: "Substituir evocação (opcional)",
        level: nextLevel,
        source: "PHB",
        optional: true,
        description: "Selecione exatamente uma opção para remover e uma para adicionar.",
        choice: {
          id: flexChoiceId("invocation", className, nextLevel),
          label: "Troca de evocação",
          kind: "custom",
          count: 2,
          options: [
            ...current.map((value) => `Remover: ${value}`),
            ...additions.map((value) => `Adicionar: ${value}`),
          ],
        },
      })
    }
  }

  if (
    (className === "fighter" ||
      className === "paladin" ||
      className === "ranger") &&
    ASI_LEVELS.has(nextLevel)
  ) {
    const current = currentFightingStyles(character, className)
    const additions = FIGHTING_STYLES[className].filter(
      (style) => !current.includes(style),
    )

    if (current.length && additions.length) {
      features.push({
        id: flexChoiceFeatureId("fighting-style", className, nextLevel),
        name: "Versatilidade marcial (opcional)",
        level: nextLevel,
        source: "Tasha",
        optional: true,
        description: "Troque um estilo de luta conhecido por outro disponível para a classe.",
        choice: {
          id: flexChoiceId("fighting-style", className, nextLevel),
          label: "Troca de estilo de luta",
          kind: "custom",
          count: 2,
          options: [
            ...current.map((value) => `Remover: ${value}`),
            ...additions.map((value) => `Adicionar: ${value}`),
          ],
        },
      })
    }
  }

  return features
}

function validateSpellReplacementPair(
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
  kind: "spell" | "cantrip",
  label: string,
  errors: string[],
): void {
  const forgetRequirement = plan.spellRequirements.find((requirement) =>
    requirement.id.startsWith(`${FLEX_PREFIX}${kind}:forget:`),
  )
  const learnRequirement = plan.spellRequirements.find((requirement) =>
    requirement.id.startsWith(`${FLEX_PREFIX}${kind}:learn:`),
  )
  if (!forgetRequirement || !learnRequirement) return

  const forget = selections.spellChoices[forgetRequirement.id] ?? []
  const learn = selections.spellChoices[learnRequirement.id] ?? []
  if (!forget.length && !learn.length) return

  if (forget.length !== 1 || learn.length !== 1) {
    errors.push(`${label}: selecione uma opção para remover e uma para aprender, ou deixe ambas vazias.`)
    return
  }

  if (forget[0] === learn[0]) {
    errors.push(`${label}: a opção nova deve ser diferente da removida.`)
  }
}

function validateChoiceReplacement(
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
  kind: "invocation" | "fighting-style",
  label: string,
  errors: string[],
): void {
  const feature = plan.features.find((entry) =>
    entry.id.startsWith(`${FLEX_PREFIX}${kind}:feature:`),
  )
  if (!feature?.choice) return

  const enabled = selections.optionalFeatureIds.includes(feature.id)
  const values = selections.choices[feature.choice.id] ?? []
  if (!enabled && !values.length) return

  const removals = values.filter((value) => value.startsWith("Remover: "))
  const additions = values.filter((value) => value.startsWith("Adicionar: "))

  if (values.length !== 2 || removals.length !== 1 || additions.length !== 1) {
    errors.push(`${label}: escolha exatamente uma opção para remover e uma para adicionar.`)
    return
  }

  if (stripChoicePrefix(removals[0]) === stripChoicePrefix(additions[0])) {
    errors.push(`${label}: a opção nova deve ser diferente da removida.`)
  }
}

function applySpellReplacement(
  character: CharacterTemplate,
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
  kind: "spell" | "cantrip",
): CharacterTemplate {
  const forgetRequirement = plan.spellRequirements.find((requirement) =>
    requirement.id.startsWith(`${FLEX_PREFIX}${kind}:forget:`),
  )
  const learnRequirement = plan.spellRequirements.find((requirement) =>
    requirement.id.startsWith(`${FLEX_PREFIX}${kind}:learn:`),
  )
  if (!forgetRequirement || !learnRequirement) return character

  const forget = selections.spellChoices[forgetRequirement.id]?.[0]
  const learn = selections.spellChoices[learnRequirement.id]?.[0]
  if (!forget || !learn) return character

  const nextClass = character
    .get("sheet")
    .classes?.find((entry) => entry.className === plan.className)
  let next = character.removeSpell(forget)

  next = next.addSpell({
    source: {
      type: "class",
      name: plan.className,
      sourceId: nextClass?.subclass?.id
        ? `${plan.className}:${nextClass.subclass.id}`
        : plan.className,
      attribute:
        nextClass?.castingAttribute ?? castingAttributeFor(plan.className),
    },
    spells: {
      id: learn,
      prepared:
        kind === "cantrip" ||
        nextClass?.knownSpells?.mode === "limited" ||
        plan.className === "warlock",
    },
  })

  return next
}

function applyChoiceReplacement(
  character: CharacterTemplate,
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
  kind: "invocation" | "fighting-style",
): CharacterTemplate {
  const feature = plan.features.find((entry) =>
    entry.id.startsWith(`${FLEX_PREFIX}${kind}:feature:`),
  )
  if (!feature?.choice) return character
  if (!selections.optionalFeatureIds.includes(feature.id)) return character

  const values = selections.choices[feature.choice.id] ?? []
  const removal = values.find((value) => value.startsWith("Remover: "))
  const addition = values.find((value) => value.startsWith("Adicionar: "))
  if (!removal || !addition) return character

  const oldName = stripChoicePrefix(removal)
  const newName = stripChoicePrefix(addition)
  const oldAbility = character.get("abilities")?.find((ability) => {
    if (ability.name !== oldName) return false
    return kind === "invocation"
      ? ability.category === "invocation"
      : true
  })

  let next = oldAbility
    ? character.removeAbility(oldAbility.id)
    : character
  const sourceChoiceId =
    kind === "invocation"
      ? `invocations-replacement-${plan.nextClassLevel}`
      : `fighting-style-replacement-${plan.nextClassLevel}`

  next = next.addAbility({
    id: choiceAbilityId(plan.className, sourceChoiceId, newName),
    name: newName,
    description: `${feature.name}. ${oldName} foi substituído por ${newName} no nível ${plan.nextClassLevel} de ${plan.progression.label}.`,
    kind: "passive",
    category: kind === "invocation" ? "invocation" : "general",
    sourceAbilityId: `class-choice:${plan.className}:${kind}:${slug(newName)}`,
    sourceVersion: 1,
  })

  const classes = next.get("sheet").classes ?? []
  const nextClasses = classes.map((entry) => {
    if (entry.className !== plan.className) return entry
    return {
      ...entry,
      levelChoices: {
        ...(entry.levelChoices ?? {}),
        [feature.choice!.id]: values,
      },
    }
  })

  return next.withSheet("classes", nextClasses)
}

function stripFlexibilityFromPlan(
  plan: ExpandedLevelUpPlan,
): ExpandedLevelUpPlan {
  const features = plan.features.filter(
    (feature) => !feature.id.startsWith(FLEX_PREFIX),
  )

  return {
    ...plan,
    features,
    choices: features.flatMap((feature) =>
      feature.choice ? [feature.choice] : [],
    ),
    spellRequirements: plan.spellRequirements.filter(
      (requirement) => !requirement.id.startsWith(FLEX_PREFIX),
    ),
  }
}

function stripFlexibilityFromSelections(
  selections: LevelUpSelections,
): LevelUpSelections {
  return {
    ...selections,
    optionalFeatureIds: selections.optionalFeatureIds.filter(
      (id) => !id.startsWith(FLEX_PREFIX),
    ),
    choices: Object.fromEntries(
      Object.entries(selections.choices).filter(
        ([id]) => !id.startsWith(FLEX_PREFIX),
      ),
    ),
    spellChoices: Object.fromEntries(
      Object.entries(selections.spellChoices).filter(
        ([id]) => !id.startsWith(FLEX_PREFIX),
      ),
    ),
  }
}

function currentInvocations(character: CharacterTemplate): string[] {
  const fromAbilities = (character.get("abilities") ?? [])
    .filter((ability) => ability.category === "invocation")
    .map((ability) => ability.name)
  const fromChoices = (character.get("sheet").classes ?? [])
    .filter((entry) => entry.className === "warlock")
    .flatMap((entry) =>
      Object.entries(entry.levelChoices ?? {})
        .filter(([id]) => id.includes("invocation"))
        .flatMap(([, values]) => values),
    )

  return unique([...fromAbilities, ...fromChoices]).filter((value) =>
    WARLOCK_INVOCATIONS.includes(value),
  )
}

function currentFightingStyles(
  character: CharacterTemplate,
  className: "fighter" | "paladin" | "ranger",
): string[] {
  const available = FIGHTING_STYLES[className]
  const fromAbilities = (character.get("abilities") ?? [])
    .map((ability) => ability.name)
    .filter((name) => available.includes(name))
  const fromChoices = (character.get("sheet").classes ?? [])
    .filter((entry) => entry.className === className)
    .flatMap((entry) =>
      Object.entries(entry.levelChoices ?? {})
        .filter(([id]) => id.includes("fighting-style"))
        .flatMap(([, values]) => values),
    )

  return unique([...fromAbilities, ...fromChoices]).filter((value) =>
    available.includes(value),
  )
}

function canReplaceKnownSpell(
  className: ClassName,
  subclassId?: string,
): boolean {
  return (
    className === "bard" ||
    className === "ranger" ||
    className === "sorcerer" ||
    className === "warlock" ||
    thirdCasterWizardList(className, subclassId)
  )
}

function canReplaceCantrip(className: ClassName): boolean {
  return (
    className === "artificer" ||
    className === "bard" ||
    className === "cleric" ||
    className === "druid" ||
    className === "sorcerer" ||
    className === "warlock" ||
    className === "wizard"
  )
}

function thirdCasterWizardList(
  className: ClassName,
  subclassId?: string,
): boolean {
  return (
    (className === "fighter" && subclassId === "eldritch-knight") ||
    (className === "rogue" && subclassId === "arcane-trickster")
  )
}

function getMaximumSpellLevel(
  className: ClassName,
  level: number,
  subclassId?: string,
): number {
  if (className === "warlock") return Math.min(5, Math.ceil(level / 2))
  if (thirdCasterWizardList(className, subclassId)) {
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

function flexSpellId(
  kind: "spell" | "cantrip",
  action: "forget" | "learn",
  className: ClassName,
  level: number,
): string {
  return `${FLEX_PREFIX}${kind}:${action}:${className}:${level}`
}

function flexChoiceFeatureId(
  kind: "invocation" | "fighting-style",
  className: ClassName,
  level: number,
): string {
  return `${FLEX_PREFIX}${kind}:feature:${className}:${level}`
}

function flexChoiceId(
  kind: "invocation" | "fighting-style",
  className: ClassName,
  level: number,
): string {
  return `${FLEX_PREFIX}${kind}:choice:${className}:${level}`
}

function stripChoicePrefix(value: string): string {
  return value.replace(/^(Remover|Adicionar):\s*/, "").trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function localizeSubclass(
  subclass: SubclassDefinition,
): SubclassDefinition {
  return {
    ...subclass,
    name: getSubclassNamePt(
      subclass.id,
      subclass.name,
      subclass.className,
    ),
    features: subclass.features.map(localizeFeature),
  }
}

function localizeFeature(
  feature: LevelFeatureDefinition,
): LevelFeatureDefinition {
  return {
    ...feature,
    name: getFeatureNamePt(feature.name),
    choice: feature.choice
      ? localizeChoice(feature.choice)
      : undefined,
  }
}

function localizeChoice(
  choice: LevelChoiceDefinition,
): LevelChoiceDefinition {
  return {
    ...choice,
    label: getChoiceLabelPt(choice.label),
    options: choice.options?.map(getChoiceOptionPt),
  }
}

function isClassName(value: unknown): value is ClassName {
  return (
    value === "artificer" ||
    value === "barbarian" ||
    value === "bard" ||
    value === "cleric" ||
    value === "druid" ||
    value === "fighter" ||
    value === "monk" ||
    value === "paladin" ||
    value === "ranger" ||
    value === "rogue" ||
    value === "sorcerer" ||
    value === "warlock" ||
    value === "wizard"
  )
}
