import type { CharacterTemplate } from "../characters/CharacterTemplate"
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
function isCustomRuntimeClass(className: ClassName): boolean {
  const value = String(className)
  return value === "__custom__" || value.startsWith("__custom__-")
}

const EMPTY_RULE: ClassProficiencyRule = {
  savingThrows: [],
  initial: [],
  multiclass: [],
}

/** No class proficiency package is bundled; users configure it on the sheet. */
export const CLASS_PROFICIENCY_RULES = Object.fromEntries(
  CLASS_NAMES.map((className) => [className, EMPTY_RULE]),
) as unknown as Record<ClassName, ClassProficiencyRule>

export function getClassProficiencyRule(className: ClassName): ClassProficiencyRule {
  if (isCustomRuntimeClass(className)) return EMPTY_RULE
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
