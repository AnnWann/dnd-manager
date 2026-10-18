export const POUNDS_TO_KILOGRAMS = 0.45359237
export type CreatureSizeCategory = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan"
const MULTIPLIERS: Record<CreatureSizeCategory, number> = {
  tiny: 0.5, small: 1, medium: 1, large: 2, huge: 4, gargantuan: 8,
}
export type EncumbranceState = "normal" | "encumbered" | "heavily-encumbered" | "over-capacity"
export type EncumbranceInfo = {
  weight: number
  encumbranceLimit: number
  heavyEncumbranceLimit: number
  carryingCapacity: number
  state: EncumbranceState
  speedPenalty: number
}
export function getCreatureSizeCapacityMultiplier(size?: CreatureSizeCategory): number {
  return MULTIPLIERS[size ?? "medium"]
}
export function getStrengthWeightLimitKg(strength: number, size: CreatureSizeCategory | undefined, poundsPerStrengthPoint: number): number {
  return Math.max(0, strength) * poundsPerStrengthPoint * getCreatureSizeCapacityMultiplier(size) * POUNDS_TO_KILOGRAMS
}
export function calculateEncumbrance(weight: number, strength: number, size?: CreatureSizeCategory): EncumbranceInfo {
  const encumbranceLimit = getStrengthWeightLimitKg(strength, size, 5)
  const heavyEncumbranceLimit = getStrengthWeightLimitKg(strength, size, 10)
  const carryingCapacity = getStrengthWeightLimitKg(strength, size, 15)
  const state: EncumbranceState = weight > carryingCapacity ? "over-capacity"
    : weight > heavyEncumbranceLimit ? "heavily-encumbered"
    : weight > encumbranceLimit ? "encumbered" : "normal"
  return { weight, encumbranceLimit, heavyEncumbranceLimit, carryingCapacity, state,
    speedPenalty: state === "normal" ? 0 : state === "encumbered" ? 3 : 6 }
}
