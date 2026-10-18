import type { AppStateV1 } from "./remoteState"
import { normalizeInventoryItemIds } from "../models/items/inventoryIdentity"
import type { Itemmable } from "../models/items/item"
import { preserveCharacterCustomSystems } from "./customSystems/CustomSystemPersistence"

export function normalizeAppStateInventory(
  state: AppStateV1,
): AppStateV1 {
  let changed = false

  const partyInventory = normalizeCollection(
    state.partyInventory ?? [],
    () => {
      changed = true
    },
  )

  const groundInventory = normalizeCollection(
    state.groundInventory ?? [],
    () => {
      changed = true
    },
  )

  const characters = state.characters.map((character) => {
    const inventory = normalizeCollection(
      character.inventory ?? [],
      () => {
        changed = true
      },
    )

    const customSystems = preserveCharacterCustomSystems(character)
    const customSystemsChanged = customSystems.value !== character
    if (customSystemsChanged) changed = true

    if (inventory === character.inventory && !customSystemsChanged) {
      return character
    }

    return {
      ...customSystems.value,
      inventory,
    }
  })

  if (!changed) return state

  return {
    ...state,
    characters,
    partyInventory,
    groundInventory,
  }
}

function normalizeCollection(
  items: Itemmable[],
  markChanged: () => void,
): Itemmable[] {
  const normalized = normalizeInventoryItemIds(items)
  const isEqual =
    normalized.length === items.length &&
    normalized.every(
      (item, index) =>
        stableStringify(item) === stableStringify(items[index]),
    )

  if (isEqual) return items

  markChanged()
  return normalized
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
