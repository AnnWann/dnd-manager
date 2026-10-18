type StackableItem = { id: string; quantity?: number; containerId?: string; insideBagOfHolding?: boolean; heldHands?: number; wieldedTwoHanded?: boolean }
const EQUIPMENT_STATE_FIELDS = new Set([
  "id",
  "quantity",
  "insideBagOfHolding",
  "heldHands",
  "wieldedTwoHanded",
])

function comparableItem<TItem extends StackableItem>(item: TItem): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item)
      .filter(([key]) => !EQUIPMENT_STATE_FIELDS.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function itemsShareStack<TItem extends StackableItem>(left: TItem, right: TItem): boolean {
  return JSON.stringify(comparableItem(left)) === JSON.stringify(comparableItem(right))
}

export function mergeItemIntoInventory<TItem extends StackableItem>(
  inventory: TItem[],
  item: TItem,
): TItem[] {
  const quantity = Math.max(1, Math.trunc(item.quantity ?? 1))
  const unpacked = { ...item, containerId: undefined, insideBagOfHolding: false }
  const index = inventory.findIndex((entry) => itemsShareStack(entry, unpacked))

  if (index < 0) {
    return [
      ...inventory,
      {
        ...unpacked,
        quantity,
        heldHands: undefined,
        wieldedTwoHanded: undefined,
        insideBagOfHolding: false,
      },
    ]
  }

  return inventory.map((entry, currentIndex) =>
    currentIndex === index
      ? {
          ...entry,
          quantity: Math.max(1, Math.trunc(entry.quantity ?? 1)) + quantity,
        }
      : entry,
  )
}

