import type { Itemmable } from "./item"
import { isSupplyItem } from "./SupplyItem"
import { getTotalSupplyPortions } from "../supplies/partySupply"
import { calculateItemStackWeightKg } from "../../../../../packages/game-core/src/itemWeight"

export function getItemStackWeightKg(item: Itemmable | undefined): number {
  if (!item) return 0
  return calculateItemStackWeightKg(
    item.weight,
    item.quantity ?? 1,
    isSupplyItem(item) ? getTotalSupplyPortions(item) : undefined,
  )
}
