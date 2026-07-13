import type { Itemmable } from "./item"
import { isSupplyItem } from "./SupplyItem"
import { getTotalSupplyPortions } from "../supplies/partySupply"

export function getItemStackWeightKg(item: Itemmable | undefined): number {
  if (!item) return 0

  const unitWeight = Math.max(0, Number(item.weight) || 0)

  if (isSupplyItem(item)) {
    return unitWeight * getTotalSupplyPortions(item)
  }

  const quantity = Math.max(0, Number(item.quantity ?? 1) || 0)
  return unitWeight * quantity
}
