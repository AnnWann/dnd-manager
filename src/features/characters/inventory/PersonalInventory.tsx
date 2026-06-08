import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import { InventoryEditor } from "./InventoryEditor"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  canEditInventory: boolean
}

function newInventoryItem(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "",
    desc: "",
    notes: "",
    quantity: 1,
    pockatable: false,
    weight: 0,
  }
}

export function CharacterInventory({
  character,
  updateCharacter,
}: Props) {
  const items = character.get("inventory") ?? []

  function addItem() {
    updateCharacter(character.get("id"), (c) =>
      c.with("inventory", [
        ...(c.get("inventory") ?? []),
        newInventoryItem(),
      ]),
    )
  }

  function updateItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    updateCharacter(character.get("id"), (c) =>
      c.with(
        "inventory",
        (c.get("inventory") ?? []).map((item) =>
          item.id === itemId ? updater(item) : item,
        ),
      ),
    )
  }

  function removeItem(itemId: string) {
    updateCharacter(character.get("id"), (c) =>
      c.with(
        "inventory",
        (c.get("inventory") ?? []).filter((item) => item.id !== itemId),
      ),
    )
  }

  return (
    <InventoryEditor
      title={`Inventário pessoal: ${character.get("name")}`}
      description="Itens e recursos vinculados ao personagem ativo."
      items={items}
      emptyMessage="Nenhum item no inventário pessoal."
      onAddItem={addItem}
      onUpdateItem={updateItem}
      onRemoveItem={removeItem}
      onEquipItem={(itemId) =>
        updateCharacter(character.get("id"), (c) =>
          c.equipInventoryItem(itemId)
        )
      } 
    />
  )
}