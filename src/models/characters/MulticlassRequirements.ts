import type { CharacterTemplate } from "./CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type { ClassName } from "../sheet/Class"
import { getClassNamePt } from "./ClassLocalization"

export type MulticlassRequirementGroup = {
  mode: "all" | "any"
  requirements: Array<{
    attribute: Attribute
    minimum: number
  }>
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

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

export const MULTICLASS_REQUIREMENTS: Record<
  ClassName,
  MulticlassRequirementGroup
> = {
  artificer: {
    mode: "all",
    requirements: [{ attribute: "int", minimum: 13 }],
  },
  barbarian: {
    mode: "all",
    requirements: [{ attribute: "str", minimum: 13 }],
  },
  bard: {
    mode: "all",
    requirements: [{ attribute: "cha", minimum: 13 }],
  },
  cleric: {
    mode: "all",
    requirements: [{ attribute: "wis", minimum: 13 }],
  },
  druid: {
    mode: "all",
    requirements: [{ attribute: "wis", minimum: 13 }],
  },
  fighter: {
    mode: "any",
    requirements: [
      { attribute: "str", minimum: 13 },
      { attribute: "dex", minimum: 13 },
    ],
  },
  monk: {
    mode: "all",
    requirements: [
      { attribute: "dex", minimum: 13 },
      { attribute: "wis", minimum: 13 },
    ],
  },
  paladin: {
    mode: "all",
    requirements: [
      { attribute: "str", minimum: 13 },
      { attribute: "cha", minimum: 13 },
    ],
  },
  ranger: {
    mode: "all",
    requirements: [
      { attribute: "dex", minimum: 13 },
      { attribute: "wis", minimum: 13 },
    ],
  },
  rogue: {
    mode: "all",
    requirements: [{ attribute: "dex", minimum: 13 }],
  },
  sorcerer: {
    mode: "all",
    requirements: [{ attribute: "cha", minimum: 13 }],
  },
  warlock: {
    mode: "all",
    requirements: [{ attribute: "cha", minimum: 13 }],
  },
  wizard: {
    mode: "all",
    requirements: [{ attribute: "int", minimum: 13 }],
  },
}

export function checkMulticlassRequirements(
  character: CharacterTemplate,
  targetClass: ClassName,
): MulticlassRequirementResult {
  const classes = character.get("sheet").classes ?? []
  const alreadyHasTargetClass = classes.some(
    (entry) => entry.className === targetClass,
  )
  const isMulticlassEntry = classes.length > 0 && !alreadyHasTargetClass

  if (!isMulticlassEntry) {
    return {
      allowed: true,
      isMulticlassEntry: false,
      failures: [],
    }
  }

  const classesToCheck = Array.from(
    new Set<ClassName>([
      ...classes.map((entry) => entry.className),
      targetClass,
    ]),
  )
  const failures = classesToCheck.flatMap((className) => {
    const group = MULTICLASS_REQUIREMENTS[className]
    const passes = requirementGroupPasses(character, group)

    return passes
      ? []
      : [
          {
            className,
            classLabel: getClassNamePt(className),
            requirement: formatRequirementGroup(group),
          },
        ]
  })

  return {
    allowed: failures.length === 0,
    isMulticlassEntry: true,
    failures,
  }
}

export function formatClassMulticlassRequirement(
  className: ClassName,
): string {
  return formatRequirementGroup(MULTICLASS_REQUIREMENTS[className])
}

function requirementGroupPasses(
  character: CharacterTemplate,
  group: MulticlassRequirementGroup,
): boolean {
  const values = character.get("sheet").attributes
  const checks = group.requirements.map(
    ({ attribute, minimum }) => values[attribute] >= minimum,
  )

  return group.mode === "all" ? checks.every(Boolean) : checks.some(Boolean)
}

function formatRequirementGroup(
  group: MulticlassRequirementGroup,
): string {
  const separator = group.mode === "all" ? " e " : " ou "
  return group.requirements
    .map(
      ({ attribute, minimum }) =>
        `${ATTRIBUTE_LABELS[attribute]} ${minimum}`,
    )
    .join(separator)
}
