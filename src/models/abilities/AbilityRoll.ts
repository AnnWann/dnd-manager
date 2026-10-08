import type { DamageType } from "../combat/Damage"
import type { Attribute } from "../sheet/Attribute"
import type { Skill } from "../sheet/Skills"

/** The authoritative roll performed when a standard ability is used.
 * This is independent of custom-system fields and of passive/ongoing bonuses.
 */
export type AbilityRollDamage = {
  id: string
  label?: string
  dice: string
  damageType?: DamageType
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

export function validateAbilityRoll(roll: AbilityRollDefinition | undefined): string | undefined {
  if (!roll) return undefined
  if (roll.damage && roll.damage.length > 20) return "Limite de 20 componentes de dano."
  for (const damage of roll.damage ?? []) {
    if (!/^(?:[1-9]|1\\d|20)d(?:4|6|8|10|12|20)(?:[+-]\\d{1,3})?$/i.test(damage.dice.trim().replace(/\\s+/g, ""))) {
      return `Dados inválidos em ${damage.label || "dano"}: use 1d6, 2d8+3 etc.`
    }
  }
  if (roll.kind === "damage" && !roll.damage?.length) return "Adicione pelo menos um componente de dano."
  if (roll.modifier !== undefined && (!Number.isInteger(roll.modifier) || Math.abs(roll.modifier) > 1000)) return "Modificador inválido."
  if (roll.dc !== undefined && (!Number.isInteger(roll.dc) || roll.dc < 1 || roll.dc > 1000)) return "CD inválida."
  return undefined
}
