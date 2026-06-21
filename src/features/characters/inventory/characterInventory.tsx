import { useState } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import { InventoryEditor } from "./inventoryEditor"
import { TransferItemDialog } from "./transferItemDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
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
  const {
    transferCharacters,
    transferItem,
    canTransferFromCharacter,
  } = useCharacterContext()
  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)

  const items = character.get("inventory") ?? []
  const currentWeight = character.getWeight()
  const encumbranceLimit = character.getEncumbranceLimit()
  const heavyEncumbranceLimit = character.getHeavyEncumbranceLimit()
  const carryingCapacity = character.getCarryingCapacity()
  const canTransfer = canTransferFromCharacter(character.get("id"))

  function addItem(item: Itemmable) {
    updateCharacter(character.get("id"), (current) =>
      current.addInventoryItem(item),
    )
  }

  function updateItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    updateCharacter(character.get("id"), (current) =>
      current.updateInventoryItem(itemId, updater),
    )
  }

  function removeItem(itemId: string) {
    updateCharacter(character.get("id"), (current) =>
      current.removeInventoryItem(itemId),
    )
  }

  return (
    <>
      <InventoryEditor
        title={`Inventário pessoal: ${character.get("name")}`}
        description={`Peso: ${currentWeight}/${carryingCapacity} • Sobrecarga: ${encumbranceLimit} • Sobrecarga pesada: ${heavyEncumbranceLimit}`}
        items={items}
        emptyMessage="Nenhum item encontrado."
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onEquipItem={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            current.equipInventoryItem(itemId),
          )
        }
        onPocketItem={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            current.pocketInventoryItem(itemId),
          )
        }
        onToggleBagOfHolding={(itemId) =>
          updateCharacter(character.get("id"), (current) =>
            current.toggleInventoryItemBagOfHolding(itemId),
          )
        }
        onTransferItem={canTransfer ? setTransferringItem : undefined}
      />

      <TransferItemDialog
        open={transferringItem !== null}
        item={transferringItem}
        from={{
          type: "character",
          characterId: character.get("id"),
        }}
        characters={transferCharacters}
        onClose={() => setTransferringItem(null)}
        onTransfer={transferItem}
      />
    </>
  )
}
