import { parseManualDiceExpression } from "../../shared/session-runtime/manualDiceExpression"
import type { CompendiumCreature, CreatureFeature } from "./CompendiumCreature"

const ratings = ["0", "1/8", "1/4", "1/2", ...Array.from({ length: 30 }, (_, i) => String(i + 1))]
const xp = [0, 25, 50, 100, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000]

export function creatureDefeatXp(creature: { challengeRating: string; defeatXp?: number }): number {
  if (creature.defeatXp !== undefined) return creature.defeatXp
  const rating = creature.challengeRating.trim().replace(/\s*\/\s*/g, "/").replace(",", ".")
  const decimal = /^\d+(?:\.\d+)?$/.test(rating) ? Number(rating) : undefined
  const numeric = decimal === 0.125 ? "1/8" : decimal === 0.25 ? "1/4" : decimal === 0.5 ? "1/2" : String(decimal ?? rating)
  return xp[ratings.indexOf(numeric)] ?? 0
}

export type CreatureChallengeEstimate = {
  damagePerRound: number
  accuracy: number
  accuracyKind: "attack" | "save"
  hpMultiplier: number
  offenseSource?: "sheet"
  routine?: Record<string, number>
}

const hpLimits = [6, 35, 49, 70, ...Array.from({ length: 19 }, (_, i) => 85 + i * 15), ...Array.from({ length: 11 }, (_, i) => 400 + i * 45)]
const damageLimits = [1, 3, 5, 8, ...Array.from({ length: 19 }, (_, i) => 14 + i * 6), ...Array.from({ length: 11 }, (_, i) => 140 + i * 18)]
const armor = [13, 13, 13, 13, 13, 13, 13, 14, 15, 15, 15, 16, 16, 17, 17, 17, 18, 18, 18, 18, ...Array(14).fill(19)]
const attack = [3, 3, 3, 3, 3, 3, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 9, 10, 10, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14]
const save = [13, 13, 13, 13, 13, 13, 13, 14, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 21, 21, 21, 22, 22, 22, 23]

function band(value: number, limits: number[]): number {
  const index = limits.findIndex(limit => value <= limit)
  return index === -1 ? limits.length - 1 : index
}

function adjusted(index: number, difference: number): number {
  return Math.max(0, Math.min(ratings.length - 1, index + Math.trunc(difference / 2)))
}

type ChallengeSheet = Partial<Pick<CompendiumCreature,
  "maxHp" | "armorClass" | "challengeEstimate" | "actions" | "bonusActions" | "reactions" | "legendaryActions"
>>

function featureOffense(feature: CreatureFeature) {
  const mechanics = feature.mechanics
  if (!mechanics) return undefined
  const parts = mechanics.damage.filter(part => !part.optional && part.damageType !== "healing")
  if (!parts.length) return undefined
  let damage = 0
  for (const part of parts) {
    const parsed = parseManualDiceExpression(part.formula)
    if (!parsed.ok || parsed.value.mode !== "normal") return undefined
    damage += Math.max(0, parsed.value.terms.reduce(
      (average, die) => average + die.quantity * (die.sides + 1) / 2, parsed.value.modifier,
    ))
  }
  if (damage <= 0) return undefined
  return {
    feature,
    damage,
    attackBonus: mechanics.kind === "attack" ? mechanics.attackBonus : undefined,
    saveDc: mechanics.kind === "save" || mechanics.kind === "check" ? mechanics.dc : undefined,
  }
}

export function creatureChallengeActions(creature: ChallengeSheet) {
  const options = [
    ...(creature.actions ?? []), ...(creature.bonusActions ?? []),
    ...(creature.reactions ?? []), ...(creature.legendaryActions ?? []),
  ].map(featureOffense).filter(option => option !== undefined)
  const routine = creature.challengeEstimate?.routine
  const selected = routine
    ? options.flatMap(option => {
        const count = routine[option.feature.id]
        return count > 0 ? [{ ...option, damage: option.damage * count }] : []
      })
    : []
  const repeatable = new Set(creature.actions?.filter(feature => !feature.usage).map(feature => feature.id))
  const strongest = options.filter(option => repeatable.has(option.feature.id))
    .reduce<(typeof options)[number] | undefined>((best, option) => !best || option.damage > best.damage ? option : best, undefined)
  return { options, selected: routine ? selected : strongest ? [strongest] : [] }
}

export function estimateCreatureChallenge(creature: ChallengeSheet) {
  const inputs = creature.challengeEstimate
  if (!inputs || creature.maxHp === undefined || creature.armorClass === undefined) return undefined
  const selected = inputs.offenseSource === "sheet" ? creatureChallengeActions(creature).selected : undefined
  if (selected && !selected.length) return undefined
  const damage = selected?.reduce((sum, action) => sum + action.damage, 0) ?? inputs.damagePerRound
  const effectiveHp = creature.maxHp * inputs.hpMultiplier
  const hpIndex = band(effectiveHp, hpLimits)
  const damageIndex = band(damage, damageLimits)
  const defense = adjusted(hpIndex, creature.armorClass - armor[hpIndex])
  const reference = inputs.accuracyKind === "save" ? save : attack
  const accuracyDifference = selected
    ? selected.reduce((sum, action) => {
        const difference = action.attackBonus !== undefined ? action.attackBonus - attack[damageIndex]
          : action.saveDc !== undefined ? action.saveDc - save[damageIndex] : 0
        return sum + difference * action.damage
      }, 0) / damage
    : inputs.accuracy - reference[damageIndex]
  const offense = adjusted(damageIndex, accuracyDifference)
  const numeric = (index: number) => index < 4 ? [0, 0.125, 0.25, 0.5][index] : index - 3
  const average = (numeric(defense) + numeric(offense)) / 2
  const final = ratings.reduce((best, _, index) =>
    Math.abs(numeric(index) - average) <= Math.abs(numeric(best) - average) ? index : best, 0)
  return { defense: ratings[defense], offense: ratings[offense], rating: ratings[final], damage, effectiveHp }
}
