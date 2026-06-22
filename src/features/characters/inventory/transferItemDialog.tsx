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
  canViewCharacterDetails: (characterId: string) => boolean
  onClose: () => void
  onTransfer: (request: TransferItemRequest) => void
}

export function TransferItemDialog({
  open,
  item,
  from,
  characters,
  canViewCharacterDetails,
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

      const characterId = character.get("id")
      const canViewDetails = canViewCharacterDetails(characterId)
      const owner = canViewDetails
        ? character.get("owner")?.name?.trim()
        : undefined

      options.push({
        key: `character:${characterId}`,
        label: canViewDetails
          ? owner
            ? `${character.get("name")} • ${owner}`
            : character.get("name")
          : `${character.get("name")} • Personagem privado`,
        location: {
          type: "character",
          characterId,
        },
      })
    }

    return options
  }, [canViewCharacterDetails, characters, from])

  const [destinationKey, setDestinationKey] = useState("")
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!open || !item) return
    setDestinationKey(destinations[0]?.key ?? "")
    setQuantity(Math.max(1, Math.trunc(item.quantity || 1)))
  }, [destinations, item, open])

  if (!open || !item) return null

  const currentItem = item
  const destination = destinations.find(
    (option) => option.key === destinationKey,
  )
  const maxQuantity = Math.max(
    1,
    Math.trunc(currentItem.quantity || 1),
  )

  function submit() {
    if (!destination) return

    onTransfer({
      itemId: currentItem.id,
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
      className="fixed inset-0 z-[10000] flex max-w-full items-center justify-center overflow-x-hidden bg-black/70 p-2 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full min-w-0 max-w-md overflow-hidden rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="min-w-0 border-b border-border pb-4">
          <h2 className="break-words text-base font-semibold text-textH">
            Transferir item
          </h2>
          <p className="mt-1 max-w-full break-words text-xs text-textMuted">
            {currentItem.name || "Item sem nome"} • disponível: {maxQuantity}
          </p>
        </div>

        {destinations.length === 0 ? (
          <div className="max-w-full break-words py-6 text-center text-sm text-textMuted">
            Nenhum destino disponível para este item.
          </div>
        ) : (
          <div className="grid min-w-0 max-w-full gap-4 py-4">
            <label className="grid min-w-0 gap-1.5">
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

            <label className="grid min-w-0 gap-1.5">
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

        <div className="flex min-w-0 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
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
