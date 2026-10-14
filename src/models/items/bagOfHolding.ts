import type { Itemmable } from "./item"
import { getCompartmentUsage } from "./itemCompartments"
import { isBagOfHoldingItem } from "./item"

export const BAG_OF_HOLDING_CAPACITY_KG = 226

export function getBagOfHoldingWeightKg(items: Itemmable[]): number {
  return items.filter(isBagOfHoldingItem).reduce((total, bag) => total + getCompartmentUsage(items, bag).weightKg, 0)
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
