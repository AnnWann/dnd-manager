type PocketItem = { kind?: string; pocketable?: boolean }


const AUTOMATICALLY_POCKETABLE_KINDS = new Set<string>([
  "ammunition",
  "consumable",
  "scroll",
  "throwable",
  "focus",
  "tool",
])

const NEVER_POCKETABLE_KINDS = new Set<string>([
  "currency",
  "supply",
  "pack",
  "shield",
])

export function isAutomaticallyPocketableKind(kind: string): boolean {
  return AUTOMATICALLY_POCKETABLE_KINDS.has(kind)
}

export function canItemGoInPocket(item: PocketItem): boolean {
  const kind = item.kind ?? "common"

  if (NEVER_POCKETABLE_KINDS.has(kind)) return false
  if (isAutomaticallyPocketableKind(kind)) return true

  return item.pocketable === true
}

export function getDefaultPocketableForKind(kind: string): boolean {
  return isAutomaticallyPocketableKind(kind)
}
