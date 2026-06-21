import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  InventoryLocation,
  TransferItemRequest,
} from "../../../contexts/characterContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"

type Props = {
  open: boolean
  item: Itemmable | null
  from: InventoryLocation
  characters: CharacterTemplate[]
  onClose: () => void
  onTransfer: (request: TransferItemRequest) => void
}

export function TransferItemDialog({
  open,
  item,
  from,
  characters,
  onClose,
  onTransfer,
}: Props) {
  const destinations = useMemo(() => {
    const options: Array<{
      key: string
      label: string
      location: InventoryLocation
    }> = []

    if (from.type !== "party") {
      options.push({
        key: "party",
        label: "Inventário do grupo",
        location: { type: "party" },
      })
    }

    for (const character of characters) {
      if (
        from.type === "character" &&
        from.characterId === character.get("id")
      ) {
        continue
      }

      const owner = character.get("owner")?.name?.trim()
      options.push({
        key: `character:${character.get("id")}`,
        label: owner
          ? `${character.get("name")} • ${owner}`
          : character.get("name"),
        location: {
          type: "character",
          characterId: character.get("id"),
        },
      })
    }

    return options
  }, [characters, from])

  const [destinationKey, setDestinationKey] = useState("")
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!open || !item) return
    setDestinationKey(destinations[0]?.key ?? "")
    setQuantity(Math.max(1, Math.trunc(item.quantity || 1)))
  }, [destinations, item, open])

  if (!open || !item) return null

  const destination = destinations.find(
    (option) => option.key === destinationKey,
  )
  const maxQuantity = Math.max(1, Math.trunc(item.quantity || 1))

  function submit() {
    if (!destination) return

    onTransfer({
      itemId: item.id,
      quantity: Math.max(
        1,
        Math.min(maxQuantity, Math.trunc(quantity || 1)),
      ),
      from,
      to: destination.location,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border pb-4">
          <h2 className="text-base font-semibold text-textH">
            Transferir item
          </h2>
          <p className="mt-1 break-words text-xs text-textMuted">
            {item.name || "Item sem nome"} • disponível: {maxQuantity}
          </p>
        </div>

        {destinations.length === 0 ? (
          <div className="py-6 text-center text-sm text-textMuted">
            Nenhum destino disponível para este item.
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Destino
              </span>
              <Select
                value={destinationKey}
                onChange={(event) =>
                  setDestinationKey(event.target.value)
                }
              >
                {destinations.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Quantidade
              </span>
              <Input
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Number(event.target.value) || 1)
                }
              />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!destination}
            onClick={submit}
          >
            Transferir
          </Button>
        </div>
      </div>
    </div>
  )
}
