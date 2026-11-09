import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import type { SpellGrant } from "./SpellGrant"

/** All configured requirements must be met to make a granted spell available. */
export function isGrantedSpellUnlocked(
  character: CharacterTemplate,
  grant: SpellGrant,
): boolean {
  const requirements = grant.unlockRequirements
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
    const score = (sheet.attributes?.[attribute] ?? 0) + (sheet.race.attributeBonus?.[attribute] ?? 0)
    if (score < minimum) return false
  }

  return true
}
