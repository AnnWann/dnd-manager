import type { CharacterTemplate } from "./CharacterTemplate"
import type { EquippedItemReference } from "./characterEquippedItemMovement"
import type { Itemmable } from "../items/item"

/** Read-only inventory projections. Items remain authoritative in equipment,
 * so they are never counted twice for weight, bonuses or transfers.
 */
export type EquippedInventoryEntry = {
  item: Itemmable
  reference: EquippedItemReference
  location: string
}

export function getEquippedInventoryEntries(character: CharacterTemplate): EquippedInventoryEntry[] {
  const equipment = character.get("equipment")
  const entries: EquippedInventoryEntry[] = []
  const append = (item: Itemmable | undefined, location: string, reference: EquippedItemReference) => {
    if (item) entries.push({ item, location, reference })
  }

  append(equipment.armor, "Armadura", { type: "slot", slot: "armor" })
  append(equipment.shield, "Escudo", { type: "shield" })
  append(equipment.helmet, "Capacete", { type: "slot", slot: "helmet" })
  append(equipment.gloves, "Luvas", { type: "slot", slot: "gloves" })
  append(equipment.boots, "Botas", { type: "slot", slot: "boots" })
  append(equipment.cape, "Capa", { type: "slot", slot: "cape" })
  for (const item of equipment.rings) append(item, "Anel", { type: "ring", itemId: item.id })
  for (const item of equipment.necklaces ?? []) append(item, "Colar", { type: "necklace", itemId: item.id })
  for (const item of equipment.bodyParts ?? []) append(item, "Parte corporal", { type: "body-part", itemId: item.id })
  for (const item of equipment.weapons) append(item, "Arma empunhada", { type: "weapon", itemId: item.id })
  for (const item of equipment.heldItems ?? []) append(item, "Nas mãos", { type: "held-item", itemId: item.id })

  return entries
}
