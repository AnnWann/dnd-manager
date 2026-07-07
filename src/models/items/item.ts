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

export type Item = {
  id: string
  name: string
  desc: string
  notes: string
  quantity: number
  weight: number

  pocketable: boolean
  kind: ItemKind

  equippable?: boolean
  equipSlot?: EquipSlot

  insideBagOfHolding?: boolean
}

export type Itemmable =
  | Item
  | Equipment
  | Weapon
  | Armor
  | ConsumableItem
  | ThrowableItem
  | SupplyItem
