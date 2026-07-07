import type { ItemKind, Itemmable } from "./item"

const CONSUMABLE_ITEM_KINDS = new Set<ItemKind>([
  "consumable",
  "throwable",
  "ammunition",
])

export function isConsumableItemKind(item: Itemmable): boolean {
  return CONSUMABLE_ITEM_KINDS.has(item.kind ?? "common")
}

export function consumeItemQuantity<TItem extends Itemmable>(
  item: TItem,
  amount = 1,
): TItem | null {
  if (!isConsumableItemKind(item)) return item

  const consumedAmount = Math.max(1, Math.trunc(Number(amount) || 1))
  const currentQuantity = Math.max(0, Number(item.quantity) || 0)
  const nextQuantity = currentQuantity - consumedAmount

  if (nextQuantity <= 0) return null

  return {
    ...item,
    quantity: nextQuantity,
  }
}

export function consumeInventoryItem(
  items: Itemmable[],
  itemId: string,
  amount = 1,
): Itemmable[] {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return items

  const item = items[index]
  if (!isConsumableItemKind(item)) return items

  const nextItem = consumeItemQuantity(item, amount)

  if (!nextItem) {
    return [
      ...items.slice(0, index),
      ...items.slice(index + 1),
    ]
  }

  return items.map((entry, entryIndex) =>
    entryIndex === index ? nextItem : entry,
  )
}
