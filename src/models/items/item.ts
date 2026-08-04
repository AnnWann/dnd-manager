import type { CurrencyItem } from "./Currency"
import type { Armor } from "./equipment/Armor"
import type { Equipment } from "./equipment/EquipmentSlot"
import type { ConsumableItem, ThrowableItem } from "./equipment/PocketItem"
import type { SupplyItem } from "./SupplyItem"
import type { Weapon } from "./equipment/Weapon"

export type EquipSlot =
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"
  | "cape"
  | "shield"
  | "weapon"
  | "ring"
  | "necklace"

export type ItemKind =
  | "common"
  | "equipment"
  | "consumable"
  | "throwable"
  | "supply"
  | "ammunition"
  | "tool"
  | "focus"
  | "instrument"
  | "pack"
  | "gear"
  | "currency"
  | "shield"

export type ItemCategory = "bagOfHolding"
export type ItemOrigin = "standard" | "custom"

export type Item = {
  id: string
  name: string
  desc: string
  notes: string
  quantity: number
  weight: number

  pocketable: boolean
  kind: ItemKind
  category?: ItemCategory

  /** Stable source definition used to restore protected canonical fields. */
  compendiumItemId?: string
  itemOrigin?: ItemOrigin

  equippable?: boolean
  equipSlot?: EquipSlot

  magicItem?: boolean
  requiresAttunement?: boolean
  attuned?: boolean

  insideBagOfHolding?: boolean

  /** Quantidade de mãos usadas enquanto o item está sendo segurado. */
  heldHands?: 1 | 2
}

export type Itemmable =
  | Item
  | CurrencyItem
  | Equipment
  | Weapon
  | Armor
  | ConsumableItem
  | ThrowableItem
  | SupplyItem

export function isBagOfHoldingItem(item: Itemmable): boolean {
  return item.category === "bagOfHolding"
}

export function isStandardCompendiumItem(item: Itemmable): boolean {
  return item.itemOrigin === "standard" && Boolean(item.compendiumItemId)
}
