import type { Die } from "../../dice/Die"
import type { Item, Itemmable } from "../item"

export type PocketItem = Itemmable & {
  pocketUse?: "stored" | "sheathed" | "consumable" | "throwable"
}

export type ConsumableItem = Item & {
  kind: "consumable"
  useText?: string
}

export type ThrowableItem = Item & {
  kind: "throwable"
  range?: string
  damage?: Die
}