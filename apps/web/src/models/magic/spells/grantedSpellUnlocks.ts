import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import type { SpellGrant } from "./SpellGrant"
import type { Attribute } from "../../sheet/Attribute"
import { getAsiAttributeIncrease } from "../../characters/CharacterAsi"
import { evaluateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"
import { getCharacterFormulaValues, listCharacterFormulaVariables } from "../../../lib/customSystems/CharacterFormulaVariables"

/** Compare a numeric variable from the character sheet to a minimum formula. */
export type UnlockVariableRequirement = {
  variable: string
  minimum: string
}

export type UnlockRequirements = {
  /** General-purpose rules. Every condition must pass. */
  conditions?: UnlockVariableRequirement[]
  /** Legacy prerequisites kept for already-created abilities and spells. */
  minimumCharacterLevel?: number
  attribute?: Attribute
  minimumAttributeScore?: number
}

export function meetsUnlockRequirements(
  character: CharacterTemplate,
  requirements?: UnlockRequirements,
): boolean {
  if (!requirements) return true

  const level = requirements.minimumCharacterLevel
  if (level !== undefined) {
    if (!Number.isInteger(level) || level < 1) return false
    const currentLevel = (character.get("sheet").classes ?? [])
      .reduce((sum, entry) => sum + entry.level, 0)
    if (currentLevel < level) return false
  }
  if (requirements.attribute || requirements.minimumAttributeScore !== undefined) {
    const attribute = requirements.attribute
    const minimum = requirements.minimumAttributeScore
    if (!attribute || minimum === undefined || !Number.isInteger(minimum) || minimum < 1 || minimum > 30) return false
    const sheet = character.get("sheet")
    const score = (sheet.attributes?.[attribute] ?? 0) + (sheet.race.attributeBonus?.[attribute] ?? 0) + getAsiAttributeIncrease(character, attribute)
    if (score < minimum) return false
  }

  if (!requirements.conditions?.length) return true
  const numericPaths = new Set(listCharacterFormulaVariables(character)
    .filter(variable => variable.valueType === "number")
    .map(variable => variable.path))

  return requirements.conditions.every(({ variable, minimum }) => {
    if (!numericPaths.has(variable) || !minimum?.trim()) return false
    const currentValue = getCharacterFormulaValues(character, [variable])[variable]
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) return false
    const threshold = evaluateCharacterSheetFormula(minimum, character)
    return threshold !== undefined && Number.isFinite(threshold) && currentValue >= threshold
  })
}

/** All spell requirements must pass in addition to its parent ability's requirements. */
export function isGrantedSpellUnlocked(
  character: CharacterTemplate,
  grant: SpellGrant,
): boolean {
  return meetsUnlockRequirements(character, grant.unlockRequirements)
}
