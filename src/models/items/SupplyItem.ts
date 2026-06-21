import type { Item } from "./item"
import type { SupplyPackageKind } from "../supplies/partySupply"

export type SupplyCategory = "food" | "drink" | "mixed" | "other"

export type SupplyItem = Item & {
  kind: "supply"
  supplyCategory: SupplyCategory
  /** Physical package represented by each inventory quantity. */
  supplyPackage?: SupplyPackageKind
  /** Standard daily portions contained by each inventory quantity. */
  supplyUnitsPerItem: number
  /** Human-readable package label retained for display and old imports. */
  supplyUnitLabel?: string
}

export function isSupplyItem(item: Item): item is SupplyItem {
  return item.kind === "supply"
}
