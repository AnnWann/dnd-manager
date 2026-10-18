import type { CharacterTemplate } from "./CharacterTemplate"
import type { Itemmable } from "../items/item"

/** Scrolls grant their spell only while held in a hand or carried in a pocket. */
export function getUsableScroll(character: CharacterTemplate, itemId: string, spellIndex?: string): Itemmable | undefined {
  const equipment = character.get("equipment")
  return [...equipment.pockets, ...(equipment.heldItems ?? [])].find(item =>
    item.id === itemId && item.kind === "scroll" &&
    Boolean(item.scrollSpellIndex) &&
    (!spellIndex || item.scrollSpellIndex === spellIndex) &&
    (item.quantity ?? 1) > 0,
  )
}

/** Consume one scroll atomically with the spell cast; never copy it into inventory. */
export function consumeCharacterScroll(character: CharacterTemplate, itemId: string, spellIndex: string): CharacterTemplate {
  if (!getUsableScroll(character, itemId, spellIndex)) return character
  const equipment = character.get("equipment")
  const consume = (items: Itemmable[]): Itemmable[] => items.flatMap(item => {
    if (item.id !== itemId) return [item]
    const quantity = Math.max(1, Math.trunc(item.quantity ?? 1))
    return quantity > 1 ? [{ ...item, quantity: quantity - 1 }] : []
  })
  return character.with("equipment", {
    ...equipment,
    pockets: consume(equipment.pockets),
    heldItems: consume(equipment.heldItems ?? []),
  })
}
