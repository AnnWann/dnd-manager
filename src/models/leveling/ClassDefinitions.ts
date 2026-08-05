import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { Attribute } from "../sheet/Attribute"
import type {
  CharacterClassInterface,
  ClassName,
  KnownSpellMode,
  KnownSpellsRule,
  SpellcastingProgression,
} from "../sheet/Class"
import {
  EXPANDED_CLASS_PROGRESSIONS,
  type ClassProgressionDefinition,
} from "./ExpandedClassProgression"

export type ClassDefinition = ClassProgressionDefinition & {
  displayName: string
  castingAttribute?: Attribute
  spellcastingProgression?: SpellcastingProgression
  knownSpells?: KnownSpellsRule
}

const CLASS_DISPLAY_NAMES: Record<ClassName, string> = {
  artificer: "Artífice",
  barbarian: "Bárbaro",
  bard: "Bardo",
  cleric: "Clérigo",
  druid: "Druida",
  fighter: "Guerreiro",
  monk: "Monge",
  paladin: "Paladino",
  ranger: "Patrulheiro",
  rogue: "Ladino",
  sorcerer: "Feiticeiro",
  warlock: "Bruxo",
  wizard: "Mago",
}

const BARD_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 4,
  perLevel: 1,
  overrides: {
    10: 14,
    11: 15,
    12: 15,
    13: 16,
    14: 18,
    15: 19,
    16: 19,
    17: 20,
    18: 22,
    19: 22,
    20: 22,
  },
}

const SORCERER_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 2,
  perLevel: 1,
  overrides: {
    12: 12,
    14: 13,
    16: 14,
    18: 15,
    19: 15,
    20: 15,
  },
}

const WARLOCK_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 2,
  perLevel: 1,
  overrides: {
    10: 10,
    12: 11,
    14: 12,
    16: 13,
    18: 14,
    20: 15,
  },
}

const RANGER_KNOWN_SPELLS: KnownSpellsRule = {
  mode: "limited",
  baseAtLevel1: 0,
  perLevel: 1,
  overrides: {
    1: 0,
    2: 2,
    3: 3,
    4: 3,
    5: 4,
    6: 4,
    7: 5,
    8: 5,
    9: 6,
    10: 6,
    11: 7,
    12: 7,
    13: 8,
    14: 8,
    15: 9,
    16: 9,
    17: 10,
    18: 10,
    19: 11,
    20: 11,
  },
}

function preparedSpells(
  className: ClassName,
  castingAttribute: Attribute,
  levelDivisor = 1,
  mode: KnownSpellMode = "prepared-only",
  baseAtLevel1 = 0,
  perLevel = 0,
): KnownSpellsRule {
  return {
    mode,
    baseAtLevel1,
    perLevel,
    canPrepare: (character) =>
      Math.max(
        1,
        Math.floor(character.getClassLevel(className) / levelDivisor) +
          character.getEffectiveAttributeModifier(castingAttribute),
      ),
  }
}

const CLASS_STATIC_RULES: Record<
  ClassName,
  Pick<
    ClassDefinition,
    "castingAttribute" | "spellcastingProgression" | "knownSpells"
  >
> = {
  artificer: {
    castingAttribute: "int",
    spellcastingProgression: "half",
    knownSpells: preparedSpells("artificer", "int", 2),
  },
  barbarian: {},
  bard: {
    castingAttribute: "cha",
    spellcastingProgression: "full",
    knownSpells: BARD_KNOWN_SPELLS,
  },
  cleric: {
    castingAttribute: "wis",
    spellcastingProgression: "full",
    knownSpells: preparedSpells("cleric", "wis"),
  },
  druid: {
    castingAttribute: "wis",
    spellcastingProgression: "full",
    knownSpells: preparedSpells("druid", "wis"),
  },
  fighter: {},
  monk: {},
  paladin: {
    castingAttribute: "cha",
    spellcastingProgression: "half",
    knownSpells: preparedSpells("paladin", "cha", 2),
  },
  ranger: {
    castingAttribute: "wis",
    spellcastingProgression: "half",
    knownSpells: RANGER_KNOWN_SPELLS,
  },
  rogue: {},
  sorcerer: {
    castingAttribute: "cha",
    spellcastingProgression: "full",
    knownSpells: SORCERER_KNOWN_SPELLS,
  },
  warlock: {
    castingAttribute: "cha",
    spellcastingProgression: "full",
    knownSpells: WARLOCK_KNOWN_SPELLS,
  },
  wizard: {
    castingAttribute: "int",
    spellcastingProgression: "full",
    knownSpells: preparedSpells(
      "wizard",
      "int",
      1,
      "spellbook",
      6,
      2,
    ),
  },
}

export const CLASS_DEFINITIONS = Object.fromEntries(
  Object.entries(EXPANDED_CLASS_PROGRESSIONS).map(
    ([rawClassName, progression]) => {
      const className = rawClassName as ClassName

      return [
        className,
        {
          ...progression,
          ...CLASS_STATIC_RULES[className],
          displayName: CLASS_DISPLAY_NAMES[className],
        },
      ]
    },
  ),
) as Record<ClassName, ClassDefinition>

export function getClassDefinition(className: ClassName): ClassDefinition {
  return CLASS_DEFINITIONS[className]
}

export function getClassDisplayName(className: ClassName): string {
  return getClassDefinition(className).displayName
}

export function getClassCastingAttribute(
  classData: CharacterClassInterface,
): Attribute | undefined {
  const override = getRuleOverride(classData, "castingAttribute")
  if (override.found) return override.value ?? undefined

  const definitionValue = getClassDefinition(
    classData.className,
  ).castingAttribute
  const legacyValue = getOwnLegacyValue(classData, "castingAttribute")

  if (
    legacyValue !== undefined &&
    definitionValue !== undefined &&
    legacyValue !== definitionValue
  ) {
    return legacyValue
  }

  return definitionValue ?? legacyValue
}

export function getClassSpellcastingProgression(
  classData: CharacterClassInterface,
): SpellcastingProgression | undefined {
  const override = getRuleOverride(classData, "spellcastingProgression")
  if (override.found) return override.value ?? undefined

  const definitionValue = getClassDefinition(
    classData.className,
  ).spellcastingProgression
  const legacyValue = getOwnLegacyValue(
    classData,
    "spellcastingProgression",
  )

  if (
    legacyValue !== undefined &&
    definitionValue !== undefined &&
    legacyValue !== definitionValue
  ) {
    return legacyValue
  }

  return definitionValue ?? legacyValue
}

export function getClassKnownSpellsRule(
  classData: CharacterClassInterface,
): KnownSpellsRule | undefined {
  const override = getRuleOverride(classData, "knownSpells")
  if (override.found) return override.value ?? undefined

  const definitionValue = getClassDefinition(classData.className).knownSpells
  const legacyValue = getOwnLegacyValue(classData, "knownSpells")

  if (
    legacyValue !== undefined &&
    definitionValue !== undefined &&
    !areKnownSpellsRulesEquivalent(legacyValue, definitionValue)
  ) {
    return legacyValue
  }

  return definitionValue ?? legacyValue
}

export function getClassKnownSpellLimit(
  classData: CharacterClassInterface,
): number | undefined {
  const rule = getClassKnownSpellsRule(classData)
  if (!rule) return undefined

  const override = rule.overrides?.[classData.level]
  if (override !== undefined) return override

  return rule.baseAtLevel1 + Math.max(0, classData.level - 1) * rule.perLevel
}

export function getClassPreparedSpellLimit(
  character: CharacterTemplate,
  classData: CharacterClassInterface,
): number | undefined {
  const rule = getClassKnownSpellsRule(classData)
  if (!rule || (rule.mode !== "prepared-only" && rule.mode !== "spellbook")) {
    return undefined
  }

  if (typeof rule.canPrepare === "function") {
    return rule.canPrepare(character)
  }

  const canonicalRule = getClassDefinition(classData.className).knownSpells
  return typeof canonicalRule?.canPrepare === "function"
    ? canonicalRule.canPrepare(character)
    : undefined
}

export function getLegacyClassRuleOverrides(
  classData: CharacterClassInterface,
): NonNullable<CharacterClassInterface["ruleOverrides"]> {
  const definition = getClassDefinition(classData.className)
  const overrides = {
    ...(classData.ruleOverrides ?? {}),
  }
  const legacyCastingAttribute = getOwnLegacyValue(
    classData,
    "castingAttribute",
  )
  const legacyProgression = getOwnLegacyValue(
    classData,
    "spellcastingProgression",
  )
  const legacyKnownSpells = getOwnLegacyValue(classData, "knownSpells")

  if (
    legacyCastingAttribute !== undefined &&
    legacyCastingAttribute !== definition.castingAttribute
  ) {
    overrides.castingAttribute = legacyCastingAttribute
  }

  if (
    legacyProgression !== undefined &&
    legacyProgression !== definition.spellcastingProgression
  ) {
    overrides.spellcastingProgression = legacyProgression
  }

  if (
    legacyKnownSpells !== undefined &&
    !areKnownSpellsRulesEquivalent(
      legacyKnownSpells,
      definition.knownSpells,
    )
  ) {
    overrides.knownSpells = legacyKnownSpells
  }

  return overrides
}

function getRuleOverride<
  Key extends keyof NonNullable<CharacterClassInterface["ruleOverrides"]>,
>(
  classData: CharacterClassInterface,
  key: Key,
): {
  found: boolean
  value: NonNullable<CharacterClassInterface["ruleOverrides"]>[Key] | undefined
} {
  const overrides = classData.ruleOverrides

  return {
    found: Boolean(
      overrides && Object.prototype.hasOwnProperty.call(overrides, key),
    ),
    value: overrides?.[key],
  }
}

function getOwnLegacyValue<
  Key extends "castingAttribute" | "spellcastingProgression" | "knownSpells",
>(
  classData: CharacterClassInterface,
  key: Key,
): CharacterClassInterface[Key] | undefined {
  if (
    classData.definitionSnapshot ||
    !Object.prototype.hasOwnProperty.call(classData, key)
  ) {
    return undefined
  }

  return classData[key]
}

function areKnownSpellsRulesEquivalent(
  left: KnownSpellsRule | undefined,
  right: KnownSpellsRule | undefined,
): boolean {
  if (!left || !right) return left === right

  return (
    left.mode === right.mode &&
    left.baseAtLevel1 === right.baseAtLevel1 &&
    left.perLevel === right.perLevel &&
    JSON.stringify(left.overrides ?? {}) ===
      JSON.stringify(right.overrides ?? {})
  )
}
