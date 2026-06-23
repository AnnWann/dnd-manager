import { useState } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getEncumbranceInfo } from "../../../models/characters/characterEncumbrance"
import type { Itemmable } from "../../../models/items/item"
import { CharacterEncumbrancePanel } from "./characterEncumbrancePanel"
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
    canViewCharacterDetails,
  } = useCharacterContext()
  const [transferringItem, setTransferringItem] =
    useState<Itemmable | null>(null)

  const items = character.get("inventory") ?? []
  const encumbrance = getEncumbranceInfo(character)
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
      <div className="mb-4">
        <CharacterEncumbrancePanel character={character} />
      </div>

      <InventoryEditor
        title={`Inventário pessoal: ${character.get("name")}`}
        description={`Peso carregado: ${formatKg(encumbrance.weight)} de ${formatKg(encumbrance.carryingCapacity)}.`}
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
        canViewCharacterDetails={canViewCharacterDetails}
        onClose={() => setTransferringItem(null)}
        onTransfer={transferItem}
      />
    </>
  )
}

function formatKg(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`
}
