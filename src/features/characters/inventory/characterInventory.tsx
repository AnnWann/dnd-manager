import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import { InventoryEditor } from "./inventoryEditor"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  canEditInventory: boolean
}

export function newInventoryItem(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "",
    desc: "",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: false,
    kind: "common",
  }
}

export function CharacterInventoryTab({
  character,
  updateCharacter,
}: Props) {
  const items = character.get("inventory") ?? []

  const currentWeight = character.getWeight()
  const encumbranceLimit = character.getEncumbranceLimit()
  const heavyEncumbranceLimit = character.getHeavyEncumbranceLimit()
  const carryingCapacity = character.getCarryingCapacity()

  function addItem(item: Itemmable) {
    updateCharacter(character.get("id"), (c) =>
      c.with("inventory", [...(c.get("inventory") ?? []), item]),
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
      description={`Peso: ${currentWeight}/${carryingCapacity} • Sobrecarga: ${encumbranceLimit} • Sobrecarga pesada: ${heavyEncumbranceLimit}`}
      items={items}
      emptyMessage="Nenhum item encontrado."
      onAddItem={addItem}
      onUpdateItem={updateItem}
      onRemoveItem={removeItem}
      onEquipItem={(itemId) =>
        updateCharacter(character.get("id"), (c) =>
          c.equipInventoryItem(itemId),
        )
      }
      onPocketItem={(itemId) =>
        updateCharacter(character.get("id"), (c) =>
          c.pocketInventoryItem(itemId),
        )
      }
      onToggleBagOfHolding={(itemId) =>
        updateCharacter(character.get("id"), (c) =>
          c.toggleInventoryItemBagOfHolding(itemId),
        )
      }
    />
  )
}