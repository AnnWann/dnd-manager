export type NumericBonus = { type: "add" | "sub" | "flat"; value: number }

export function applyBonus<T extends NumericBonus>(baseValue: number, bonus: T): number {
  if (bonus.type === "add") return baseValue + bonus.value
  if (bonus.type === "sub") return baseValue - bonus.value
  return bonus.value
}

export function applyBonuses<T extends NumericBonus>(baseValue: number, bonuses: readonly T[]): number {
  const flatBonus = bonuses.find((bonus) => bonus.type === "flat")
  if (flatBonus) return flatBonus.value
  return bonuses.reduce((total, bonus) => applyBonus(total, bonus), baseValue)
}
