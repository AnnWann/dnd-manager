import "./ExpandedClassProgression"

import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Spell } from "../magic/spells/Spell"
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
  getChoiceLabelPt,
  getChoiceOptionPt,
  getFeatureNamePt,
} from "./FeatureLocalization"
import {
  checkMulticlassRequirements,
  type MulticlassRequirementResult,
} from "./MulticlassRequirements"
import type {
  LevelChoiceDefinition,
  LevelFeatureDefinition,
  SubclassDefinition,
} from "./ClassProgression"

export * from "./LevelUpEngine"

export type ExpandedLevelUpPlan = LevelUpPlan & {
  multiclassRequirements: MulticlassRequirementResult
}

export function getLevelUpPlan(
  character: CharacterTemplate,
  className: ClassName,
  subclassId?: string,
): ExpandedLevelUpPlan {
  const base = getBaseLevelUpPlan(character, className, subclassId)
  const localizedSubclasses = base.progression.subclasses.map(
    localizeSubclass,
  )
  const selectedSubclass = base.selectedSubclass
    ? localizeSubclass(base.selectedSubclass)
    : undefined
  const localizedFeatures = base.features.map(localizeFeature)
  const conModifier = character.getEffectiveAttributeModifier("con")
  const firstLevelHp =
    base.nextTotalLevel === 1
      ? Math.max(
          1,
          Number(base.progression.hitDie.replace("d", "")) + conModifier,
        )
      : base.averageHpGain

  return {
    ...base,
    progression: {
      ...base.progression,
      label: getClassNamePt(className),
      subclasses: localizedSubclasses,
    },
    selectedSubclass,
    features: localizedFeatures,
    choices: localizedFeatures.flatMap((feature) =>
      feature.choice ? [feature.choice] : [],
    ),
    averageHpGain: firstLevelHp,
    multiclassRequirements: checkMulticlassRequirements(
      character,
      className,
    ),
  }
}

export function validateLevelUpSelections(
  plan: ExpandedLevelUpPlan,
  selections: LevelUpSelections,
): string[] {
  const errors = validateBaseLevelUpSelections(plan, selections)

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

  return applyBaseLevelUp(character, plan, selections)
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
