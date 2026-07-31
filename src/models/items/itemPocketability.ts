import type { ItemKind, Itemmable } from "./item"

const AUTOMATICALLY_POCKETABLE_KINDS = new Set<ItemKind>([
  "ammunition",
  "consumable",
  "throwable",
  "focus",
  "tool",
])

const NEVER_POCKETABLE_KINDS = new Set<ItemKind>([
  "currency",
  "supply",
  "pack",
  "shield",
])

export function isAutomaticallyPocketableKind(kind: ItemKind): boolean {
  return AUTOMATICALLY_POCKETABLE_KINDS.has(kind)
}

export function canItemGoInPocket(item: Itemmable): boolean {
  const kind = item.kind ?? "common"

  if (NEVER_POCKETABLE_KINDS.has(kind)) return false
  if (isAutomaticallyPocketableKind(kind)) return true

  return item.pocketable === true
}

export function getDefaultPocketableForKind(kind: ItemKind): boolean {
  return isAutomaticallyPocketableKind(kind)
}
