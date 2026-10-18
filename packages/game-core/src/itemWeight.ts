/** Nonnegative item weight calculation, with fractional supply portions when available. */
export function calculateItemStackWeightKg(
  weightKg: number,
  quantity: number,
  supplyPortions?: number,
): number {
  const unitWeight = Math.max(0, Number(weightKg) || 0)
  const count = Math.max(0, Number(supplyPortions ?? quantity) || 0)
  return unitWeight * count
}
