import type { Itemmable } from "./item"

export const BAG_OF_HOLDING_CAPACITY_KG = 226

export function getItemWeightKg(item: Pick<Itemmable, "weight" | "quantity">): number {
  const weight = Math.max(0, Number(item.weight) || 0)
  const quantity = Math.max(0, Number(item.quantity ?? 1) || 0)

  return weight * quantity
}

export function getBagOfHoldingWeightKg(items: Itemmable[]): number {
  return items.reduce(
    (total, item) =>
      item.insideBagOfHolding ? total + getItemWeightKg(item) : total,
    0,
  )
}

export function getBagOfHoldingRemainingKg(items: Itemmable[]): number {
  return Math.max(
    0,
    BAG_OF_HOLDING_CAPACITY_KG - getBagOfHoldingWeightKg(items),
  )
}

export function isBagOfHoldingOverCapacity(items: Itemmable[]): boolean {
  return getBagOfHoldingWeightKg(items) > BAG_OF_HOLDING_CAPACITY_KG + 0.000001
}
