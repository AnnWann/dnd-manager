import type { Item } from "./item"

export type SupplyCategory = "food" | "drink" | "mixed" | "other"

export type SupplyItem = Item & {
  kind: "supply"
  supplyCategory: SupplyCategory
  /** Abstract supply units contained by each inventory quantity. Rest math is intentionally deferred. */
  supplyUnitsPerItem: number
  /** Human-readable unit such as portions, liters, barrels or rations. */
  supplyUnitLabel?: string
}

export function isSupplyItem(item: Item): item is SupplyItem {
  return item.kind === "supply"
}
