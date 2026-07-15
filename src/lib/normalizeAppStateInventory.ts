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
        item.id === items[index]?.id &&
        item.name === items[index]?.name,
    )

  if (isEqual) return items

  markChanged()
  return normalized
}
