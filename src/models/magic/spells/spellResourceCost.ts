import type { CharacterTemplate } from "../../characters/CharacterTemplate"
import { getChannelDivinityPool, spendChannelDivinity } from "../../characters/characterChannelDivinity"
import { getKiPool, spendKi } from "../../characters/characterKi"
import { getSorceryPoints, setSorceryPoints } from "../../characters/characterMagic"
import type { SpellResourceCost, SpellResourceType } from "./Spell"

export const SPELL_RESOURCE_OPTIONS: Array<{ value: SpellResourceType; label: string }> = [
  { value: "ki", label: "Ki" },
  { value: "sorceryPoints", label: "Pontos de magia" },
  { value: "channelDivinity", label: "Canalizar Divindade" },
]

export function spellResourceLabel(resource: SpellResourceType): string {
  return SPELL_RESOURCE_OPTIONS.find((option) => option.value === resource)?.label ?? resource
}

export function getSpellResourceCurrent(
  character: CharacterTemplate,
  resource: SpellResourceType,
): number {
  if (resource === "ki") return getKiPool(character)?.current ?? 0
  if (resource === "channelDivinity") return getChannelDivinityPool(character)?.current ?? 0
  return getSorceryPoints(character).current
}

export function canPaySpellResourceCost(
  character: CharacterTemplate,
  cost: SpellResourceCost | undefined,
): boolean {
  if (!cost) return true
  const amount = normalizeAmount(cost.amount)
  return amount > 0 && getSpellResourceCurrent(character, cost.resource) >= amount
}

export function spendSpellResourceCost(
  character: CharacterTemplate,
  cost: SpellResourceCost,
): CharacterTemplate {
  const amount = normalizeAmount(cost.amount)
  if (amount <= 0 || !canPaySpellResourceCost(character, cost)) return character

  if (cost.resource === "ki") return spendKi(character, amount)
  if (cost.resource === "channelDivinity") {
    let next = character
    for (let index = 0; index < amount; index += 1) next = spendChannelDivinity(next)
    return next
  }

  const points = getSorceryPoints(character)
  return setSorceryPoints(character, points.current - amount)
}

function normalizeAmount(value: number): number {
  return Math.max(1, Math.trunc(Number(value) || 1))
}
