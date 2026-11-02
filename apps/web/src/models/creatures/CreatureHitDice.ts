/** Hit dice are editable metadata; inferring them must never change existing HP. */
export function normalizeCreatureHitDice(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const match = value.replace(/\s+/g, "").match(/^(\d{1,4})d(4|6|8|10|12|20)([+-]\d{1,6})?$/i)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 2000) return undefined
  return `${Number(match[1])}d${Number(match[2])}${match[3] ? Number(match[3]) >= 0 ? `+${Number(match[3])}` : Number(match[3]) : ""}`
}

export function inferCreatureHitDice(creature: {
  maxHp?: number; size?: string; challengeRating?: string; abilityScores?: { con?: number }
}): string {
  const size = (creature.size ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const sides = /miud|minusc|tiny/.test(size) ? 4 : /pequen|small/.test(size) ? 6
    : /enorme|huge/.test(size) ? 12 : /imenso|gargant|colossal|abissal/.test(size) ? 20
    : /grande|large/.test(size) ? 10 : 8
  const con = Math.floor(((creature.abilityScores?.con ?? 10) - 10) / 2)
  const parts = (creature.challengeRating ?? "0").replace(",", ".").split("/").map(Number)
  const cr = parts.length === 2 ? parts[0] / parts[1] : parts[0]
  const fallbackCount = Math.max(1, Math.min(2000, Math.ceil(Number.isFinite(cr) ? cr : 0) + 1))
  const hp = creature.maxHp
  const count = hp !== undefined && Number.isFinite(hp) && hp > 0
    ? Math.max(1, Math.min(2000, Math.round(hp / Math.max(1, (sides + 1) / 2 + con))))
    : fallbackCount
  // Residual adjustment preserves even homebrew HP totals exactly (rounded average).
  const modifier = hp !== undefined && Number.isFinite(hp)
    ? Math.round(hp) - Math.floor(count * (sides + 1) / 2)
    : count * con
  return `${count}d${sides}${modifier ? modifier > 0 ? `+${modifier}` : modifier : ""}`
}
