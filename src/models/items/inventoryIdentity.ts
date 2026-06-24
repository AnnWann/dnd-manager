import { normalizeItemText } from "../../lib/textNormalization"
import { withShieldDefaults } from "./equipment/Shield"
import type { Itemmable } from "./item"

export function normalizeInventoryItemIds(
  items: Itemmable[] | undefined,
): Itemmable[] {
  const seen = new Set<string>()

  return (items ?? []).map((item) => {
    const currentId =
      typeof item.id === "string" ? item.id.trim() : ""
    const id = currentId && !seen.has(currentId)
      ? currentId
      : crypto.randomUUID()

    seen.add(id)

    return normalizeInventoryItem({
      ...item,
      id,
    })
  })
}

export function prepareInventoryItemForInsert(
  item: Itemmable,
  existingItems: Itemmable[],
): Itemmable {
  const existingIds = new Set(
    existingItems
      .map((entry) =>
        typeof entry.id === "string" ? entry.id.trim() : "",
      )
      .filter(Boolean),
  )
  const requestedId =
    typeof item.id === "string" ? item.id.trim() : ""
  const id = requestedId && !existingIds.has(requestedId)
    ? requestedId
    : crypto.randomUUID()

  return normalizeInventoryItem({
    ...item,
    id,
  })
}

export function updateSingleInventoryItem(
  items: Itemmable[],
  itemId: string,
  updater: (item: Itemmable) => Itemmable,
): Itemmable[] {
  let updated = false

  return items.map((item) => {
    if (updated || item.id !== itemId) return item

    updated = true
    const next = normalizeInventoryItem(updater({ ...item }))

    return {
      ...next,
      id: item.id,
    }
  })
}

export function removeSingleInventoryItem(
  items: Itemmable[],
  itemId: string,
): Itemmable[] {
  const index = items.findIndex((item) => item.id === itemId)
  if (index < 0) return items

  return [
    ...items.slice(0, index),
    ...items.slice(index + 1),
  ]
}

function normalizeInventoryItem(item: Itemmable): Itemmable {
  const normalized = normalizeItemText(item)

  return normalized.kind === "shield"
    ? withShieldDefaults(normalized)
    : normalized
}
