import type { Ability, AbilitySelfDamageCost } from "./Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"

export type SelfDamageRollRequirement = {
  key: string
  label: string
  dice: string
  minimum: number
  maximum: number
  damageType: string
}

const DICE_PATTERN = /^(\\d{1,2})d(4|6|8|10|12|20)$/i

function diceBounds(dice: string): { count: number; sides: number } | null {
  const match = DICE_PATTERN.exec(dice.trim())
  if (!match) return null
  const count = Number(match[1])
  const sides = Number(match[2])
  return count >= 1 && count <= 20 ? { count, sides } : null
}

export function getAbilitySelfDamageRollRequirements(
  ability: Ability,
  optionId?: string,
): SelfDamageRollRequirement[] {
  const costs: Array<{ key: string; label: string; cost: AbilitySelfDamageCost }> = []
  if (ability.selfDamageOnUse) {
    costs.push({ key: "self-damage:base", label: "Dano próprio ao ativar", cost: ability.selfDamageOnUse })
  }
  const option = ability.activationOptions?.find(entry => entry.id === optionId)
  if (option?.selfDamageOnUse) {
    costs.push({ key: "self-damage:option", label: `Dano próprio — ${option.name}`, cost: option.selfDamageOnUse })
  }
  return costs.map(({ key, label, cost }) => {
    const bounds = diceBounds(cost.dice)
    return {
      key, label, dice: cost.dice,
      minimum: bounds?.count ?? 0,
      maximum: bounds ? bounds.count * bounds.sides : 0,
      damageType: cost.damageType,
    }
  })
}

export function abilityHasSelfDamage(ability: Ability): boolean {
  return Boolean(ability.selfDamageOnUse || ability.activationOptions?.some(option => option.selfDamageOnUse))
}

/**
 * Missing roll results are rolled digitally. The session server validates that
 * physical-dice sessions supply each result, and drops client-supplied values
 * from digital sessions. No resistance or temporary HP can offset this cost.
 */
export function resolveAbilitySelfDamage(
  ability: Ability,
  optionId?: string,
  rollValues?: Record<string, number>,
): number | null {
  let total = 0
  for (const requirement of getAbilitySelfDamageRollRequirements(ability, optionId)) {
    if (!requirement.minimum || !requirement.maximum) return null
    const submitted = rollValues?.[requirement.key]
    if (submitted !== undefined) {
      if (!Number.isInteger(submitted) || submitted < requirement.minimum || submitted > requirement.maximum) return null
      total += submitted
      continue
    }
    const bounds = diceBounds(requirement.dice)!
    for (let index = 0; index < bounds.count; index += 1) {
      total += 1 + Math.floor(Math.random() * bounds.sides)
    }
  }
  return total
}

export function applyAbilitySelfDamage(
  character: CharacterTemplate,
  amount: number,
): CharacterTemplate {
  if (!Number.isInteger(amount) || amount < 0) return character
  if (amount === 0) return character
  return character.setCurrentHp(character.get("sheet").HP.current - amount)
}
