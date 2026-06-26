import "./ExpandedClassProgression"

import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { ClassName } from "../sheet/Class"
import {
  applyLevelUp as applyBaseLevelUp,
  getLevelUpPlan as getBaseLevelUpPlan,
  validateLevelUpSelections as validateBaseLevelUpSelections,
  type LevelUpPlan,
  type LevelUpSelections,
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

function localizeSubclass(
  subclass: SubclassDefinition,
): SubclassDefinition {
  return {
    ...subclass,
    name: getSubclassNamePt(subclass.id, subclass.name),
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
