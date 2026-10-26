import { parseAbilityDamageFormula } from "../../../../../packages/session-protocol/src/abilityDamageFormula"
export { parseAbilityDamageFormula } from "../../../../../packages/session-protocol/src/abilityDamageFormula"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { evaluateCharacterSheetFormula, validateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { HpEffectType } from "../combat/Damage"
import type { Attribute } from "../sheet/Attribute"
import type { Skill } from "../sheet/Skills"

/** The authoritative roll performed when a standard ability is used.
 * This is independent of custom-system fields and of passive/ongoing bonuses.
 */
export type AbilityRollDamage = {
  id: string
  label?: string
  dice: string
  damageType?: HpEffectType
  /** Add the configured ability attribute modifier to this damage component. */
  addAttributeModifier?: boolean
  /** Optional per-component modifier attribute, otherwise use roll.attribute. */
  attribute?: Attribute
  /** Whether this component is magical for conditional damage affinities. */
  magical?: boolean
  /** Ignore all target damage affinities (resistance, immunity and vulnerability). */
  ignoreResistance?: boolean
  /** Whether critical hits double these dice. Default: true. */
  critical?: boolean
}

export type AbilityRollDefinition = {
  kind: "attack" | "abilityCheck" | "savingThrow" | "targetSave" | "damage"
  /** Attack roll category controls scoped bonuses and on-hit riders. */
  attackType?: "weapon" | "unarmed" | "spell" | "other"
  attribute?: Attribute
  skill?: Skill
  proficient?: boolean
  /** Fixed modifier in addition to bonuses derived from the character. */
  modifier?: number
  d20Mode?: "normal" | "advantage" | "disadvantage"
  saveAttribute?: Attribute
  dcAttribute?: Attribute
  /** Optional fixed DC; otherwise 8 + proficiency + relevant ability modifier. */
  dc?: number
  onSave?: "none" | "half" | "full"
  damage?: AbilityRollDamage[]
}

export function validateAbilityRoll(roll: AbilityRollDefinition | undefined, character?: CharacterTemplate): string | undefined {
  if (!roll) return undefined
  if (roll.damage && roll.damage.length > 20) return "Limite de 20 componentes de dano."
  for (const damage of roll.damage ?? []) {
    const parsed = parseAbilityDamageFormula(damage.dice)
    const error = !parsed ? "Use dados seguidos de uma fórmula, como 1d6 + character.level." : validateCharacterSheetFormula(parsed.formula, character)
    if (error) return `${damage.label || "Dano"}: ${error}`
  }
  if (roll.kind === "damage" && !roll.damage?.length) return "Adicione pelo menos um componente de dano."
  if (roll.modifier !== undefined && (!Number.isInteger(roll.modifier) || Math.abs(roll.modifier) > 1000)) return "Modificador inválido."
  if (roll.dc !== undefined && (!Number.isInteger(roll.dc) || roll.dc < 1 || roll.dc > 1000)) return "CD inválida."
  return undefined
}

export function resolveAbilityDamageFormula(expression: string, character: CharacterTemplate) {
  const parsed = parseAbilityDamageFormula(expression)
  if (!parsed) return undefined
  const flat = evaluateCharacterSheetFormula(parsed.formula, character)
  if (flat === undefined || !Number.isInteger(flat) || Math.abs(flat) > 100_000) return undefined
  return { quantity: parsed.quantity, sides: parsed.sides, flat }
}
