import { InventoryTransferForm } from "../../../../packages/game-ui/src/InventoryTransferForm"
import { useEffect, useMemo, useState } from "react"

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

    if (from.type !== "ground") {
      options.push({
        key: "ground",
        label: "Inventário do chão",
        location: { type: "ground" },
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

  return <InventoryTransferForm
    itemName={currentItem.name || "Item sem nome"}
    maxQuantity={maxQuantity}
    destinations={destinations}
    destinationKey={destinationKey}
    quantity={quantity}
    onDestinationChange={setDestinationKey}
    onQuantityChange={setQuantity}
    onSubmit={submit}
    onClose={onClose}
  />

}
