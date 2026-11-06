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

export function estimateCreatureChallenge(creature: {
  maxHp?: number
  armorClass?: number
  challengeEstimate?: CreatureChallengeEstimate
}) {
  const inputs = creature.challengeEstimate
  if (!inputs || creature.maxHp === undefined || creature.armorClass === undefined) return undefined
  const hpIndex = band(creature.maxHp * inputs.hpMultiplier, hpLimits)
  const damageIndex = band(inputs.damagePerRound, damageLimits)
  const defense = adjusted(hpIndex, creature.armorClass - armor[hpIndex])
  const reference = inputs.accuracyKind === "save" ? save : attack
  const offense = adjusted(damageIndex, inputs.accuracy - reference[damageIndex])
  const numeric = (index: number) => index < 4 ? [0, 0.125, 0.25, 0.5][index] : index - 3
  const average = (numeric(defense) + numeric(offense)) / 2
  const final = ratings.reduce((best, _, index) =>
    Math.abs(numeric(index) - average) <= Math.abs(numeric(best) - average) ? index : best, 0)
  return { defense: ratings[defense], offense: ratings[offense], rating: ratings[final] }
}
