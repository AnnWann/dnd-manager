import type { CharacterTemplate } from "../characters/CharacterTemplate"
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

const EMPTY_REQUIREMENT: MulticlassRequirementGroup = {
  mode: "all",
  requirements: [],
}

const CLASS_NAMES: ClassName[] = [
  "artificer", "barbarian", "bard", "cleric", "druid", "fighter",
  "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
]

/** No multiclass prerequisite table is bundled; users consult their reference. */
export const MULTICLASS_REQUIREMENTS = Object.fromEntries(
  CLASS_NAMES.map((className) => [className, EMPTY_REQUIREMENT]),
) as unknown as Record<ClassName, MulticlassRequirementGroup>

export function getMulticlassRequirement(
  className: ClassName,
): MulticlassRequirementGroup {
  if (String(className) === "__custom__") return EMPTY_REQUIREMENT
  return MULTICLASS_REQUIREMENTS[className]
}

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
