import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"
import { canItemGoInPocket } from "../items/itemPocketability"
import type { HandOccupantReference } from "./characterHands"

export type EquippedItemDestination = "inventory" | "pocket" | "ground"

export type EquippedItemReference =
  | { type: "weapon"; itemId: string }
  | { type: "shield" }
  | { type: "held-item"; itemId: string }
  | {
      type: "slot"
      slot: "armor" | "helmet" | "gloves" | "boots" | "cape"
    }
  | { type: "ring"; itemId: string }
  | { type: "necklace"; itemId: string }

export function handReferenceToEquippedItemReference(
  reference: HandOccupantReference,
  itemId: string,
): EquippedItemReference {
  if (reference.type === "weapon") {
    return { type: "weapon", itemId }
  }
  if (reference.type === "held-item") {
    return { type: "held-item", itemId }
  }
  return { type: "shield" }
}

export function getEquippedItem(
  character: CharacterTemplate,
  reference: EquippedItemReference,
): Itemmable | undefined {
  const equipment = character.get("equipment")

  if (reference.type === "weapon") {
    return equipment.weapons.find((item) => item.id === reference.itemId)
  }
  if (reference.type === "shield") return equipment.shield
  if (reference.type === "held-item") {
    return (equipment.heldItems ?? []).find(
      (item) => item.id === reference.itemId,
    )
  }
  if (reference.type === "slot") return equipment[reference.slot]
  if (reference.type === "ring") {
    return equipment.rings.find((item) => item.id === reference.itemId)
  }
  return (equipment.necklaces ?? []).find(
    (item) => item.id === reference.itemId,
  )
}

export function removeEquippedItem(
  character: CharacterTemplate,
  reference: EquippedItemReference,
): { character: CharacterTemplate; item?: Itemmable } {
  const equipment = character.get("equipment")
  const item = getEquippedItem(character, reference)
  if (!item) return { character }

  if (reference.type === "weapon") {
    return {
      item,
      character: character.with("equipment", {
        ...equipment,
        weapons: equipment.weapons.filter(
          (current) => current.id !== reference.itemId,
        ),
      }),
    }
  }

  if (reference.type === "shield") {
    return {
      item,
      character: character.with("equipment", {
        ...equipment,
        shield: undefined,
      }),
    }
  }

  if (reference.type === "held-item") {
    return {
      item,
      character: character.with("equipment", {
        ...equipment,
        heldItems: (equipment.heldItems ?? []).filter(
          (current) => current.id !== reference.itemId,
        ),
      }),
    }
  }

  if (reference.type === "slot") {
    return {
      item,
      character: character.with("equipment", {
        ...equipment,
        [reference.slot]: undefined,
      }),
    }
  }

  if (reference.type === "ring") {
    return {
      item,
      character: character.with("equipment", {
        ...equipment,
        rings: equipment.rings.filter(
          (current) => current.id !== reference.itemId,
        ),
      }),
    }
  }

  return {
    item,
    character: character.with("equipment", {
      ...equipment,
      necklaces: (equipment.necklaces ?? []).filter(
        (current) => current.id !== reference.itemId,
      ),
    }),
  }
}

export function moveEquippedItemToCharacterStorage(
  character: CharacterTemplate,
  reference: EquippedItemReference,
  destination: Exclude<EquippedItemDestination, "ground">,
): CharacterTemplate {
  const item = getEquippedItem(character, reference)
  if (!item) return character

  if (destination === "pocket") {
    if (!canItemGoInPocket(item)) return character
    if (character.get("equipment").pockets.length >= 8) return character
  }

  const removed = removeEquippedItem(character, reference)
  if (!removed.item) return character

  const storedItem: Itemmable = {
    ...removed.item,
    heldHands: undefined,
    insideBagOfHolding: false,
  }

  if (destination === "inventory") {
    return removed.character.with("inventory", [
      ...removed.character.get("inventory"),
      storedItem,
    ])
  }

  return removed.character.with("equipment", {
    ...removed.character.get("equipment"),
    pockets: [
      ...removed.character.get("equipment").pockets,
      {
        ...storedItem,
        pocketable: true,
      },
    ],
  })
}
