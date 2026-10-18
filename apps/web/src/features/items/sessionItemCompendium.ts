import type {
  SessionItemCompendiumEntry,
  SessionItemCompendiumVisibility,
} from "../../api/session-item-compendium"
import type { Itemmable } from "../../models/items/item"
import { cloneCompendiumItem } from "./itemCompendium"
import {
  STANDARD_ITEM_COMPENDIUM,
  findStandardItemDefinition,
  instantiateStandardItem,
} from "./standardItemCompendium"

export type SessionCompendiumItem = {
  item: Itemmable
  custom: boolean
  visibility: SessionItemCompendiumVisibility
}

export function buildSessionCompendiumItems(
  entries: SessionItemCompendiumEntry[],
): SessionCompendiumItem[] {
  const entryByTemplateId = new Map(
    entries.map((entry) => [entry.templateId, entry]),
  )

  const standards: SessionCompendiumItem[] = STANDARD_ITEM_COMPENDIUM.map(
    (item) => ({
      item,
      custom: false,
      visibility: entryByTemplateId.get(item.id)?.visibility ?? "PUBLIC",
    }),
  )

  const customs = entries.flatMap<SessionCompendiumItem>((entry) => {
    if (!entry.custom || !entry.item) return []
    return [
      {
        item: entry.item,
        custom: true,
        visibility: entry.visibility,
      },
    ]
  })

  return [...standards, ...customs]
}

export function instantiateSessionCompendiumItem(
  entry: SessionCompendiumItem,
): Itemmable {
  const standard = findStandardItemDefinition(entry.item.id)
  if (!entry.custom && standard) {
    return instantiateStandardItem(entry.item.id, entry.item.quantity)
  }

  return {
    ...cloneCompendiumItem(entry.item),
    compendiumItemId: entry.item.id,
    itemOrigin: "custom",
  }
}
