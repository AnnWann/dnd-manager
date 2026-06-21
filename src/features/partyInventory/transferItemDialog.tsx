import { useEffect, useMemo, useState } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import type {
  InventoryLocation,
  TransferItemRequest,
} from "../../contexts/characterContext"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../models/items/item"

type Props = {
  open: boolean
  item: Itemmable | null
  source: InventoryLocation
  characters: CharacterTemplate[]
  onClose: () => void
  onTransfer: (request: TransferItemRequest) => void
}

export function TransferItemDialog({
  open,
  item,
  source,
  characters,
  onClose,
  onTransfer,
}: Props) {
  const destinations = useMemo(() => {
    const options: Array<{
      value: string
      label: string
      location: InventoryLocation
    }> = []

    if (source.type !== "party") {
      options.push({
        value: "party",
        label: "Inventário do grupo",
        location: { type: "party" },
      })
    }

    for (const character of characters) {
      if (
        source.type === "character" &&
        source.characterId === character.get("id")
      ) {
        continue
      }

      options.push({
        value: `character:${character.get("id")}`,
        label: `${character.get("name")} — ${character.get("owner")?.name || "sem jogador"}`,
        location: {
          type: "character",
          characterId: character.get("id"),
        },
      })
    }

    return options
  }, [characters, source])

  const [destinationValue, setDestinationValue] = useState("")
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!open || !item) return
    setDestinationValue(destinations[0]?.value ?? "")
    setQuantity(Math.max(1, Math.trunc(item.quantity ?? 1)))
  }, [destinations, item, open])

  if (!open || !item) return null

  const maximumQuantity = Math.max(1, Math.trunc(item.quantity ?? 1))
  const destination = destinations.find(
    (option) => option.value === destinationValue,
  )

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
          <p className="mt-1 text-xs text-textMuted">
            {item.name || "Item sem nome"} • {maximumQuantity} disponível
          </p>
        </div>

        {destinations.length > 0 ? (
          <div className="grid gap-4 py-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">Destino</span>
              <Select
                value={destinationValue}
                onChange={(event) =>
                  setDestinationValue(event.target.value)
                }
              >
                {destinations.map((option) => (
                  <option key={option.value} value={option.value}>
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
                max={maximumQuantity}
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(
                        maximumQuantity,
                        Math.trunc(Number(event.target.value) || 1),
                      ),
                    ),
                  )
                }
              />
            </label>
          </div>
        ) : (
          <div className="py-6 text-sm text-textMuted">
            Nenhum outro inventário está disponível como destino.
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!destination}
            onClick={() => {
              if (!destination) return
              onTransfer({
                from: source,
                to: destination.location,
                itemId: item.id,
                quantity,
              })
              onClose()
            }}
          >
            Transferir
          </Button>
        </div>
      </div>
    </div>
  )
}
