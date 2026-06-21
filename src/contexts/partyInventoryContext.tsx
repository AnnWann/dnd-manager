import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"

import { normalizeItemText } from "../lib/textNormalization"
import type { AppStateV1 } from "../lib/remoteState"
import { CharacterTemplate } from "../models/characters/CharacterTemplate"
import type { Itemmable } from "../models/items/item"

export type InventoryLocation =
  | { type: "party" }
  | { type: "character"; characterId: string }

export type TransferItemRequest = {
  source: InventoryLocation
  destination: InventoryLocation
  itemId: string
  quantity: number
}

type PartyInventoryContextValue = {
  partyInventory: Itemmable[]
  transferCharacters: CharacterTemplate[]
  addPartyItem: (item: Itemmable) => void
  updatePartyItem: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  removePartyItem: (itemId: string) => void
  transferItem: (request: TransferItemRequest) => void
}

type Props = {
  children: ReactNode
  appState: AppStateV1
  setAppState: React.Dispatch<React.SetStateAction<AppStateV1>>
  userRole: "master" | "player"
  userKey: string
}

const PartyInventoryContext =
  createContext<PartyInventoryContextValue | null>(null)

export function PartyInventoryProvider({
  children,
  appState,
  setAppState,
  userRole,
  userKey,
}: Props) {
  const characters = useMemo(
    () =>
      appState.characters.map((rawCharacter) =>
        CharacterTemplate.fromJSON(rawCharacter),
      ),
    [appState.characters],
  )

  const transferCharacters = useMemo(() => {
    if (userRole === "master") return characters

    const normalizedUserKey = userKey.trim()

    return characters.filter((character) => {
      const isOwner =
        character.get("owner")?.id?.trim() === normalizedUserKey

      return isOwner || character.get("visibility") === "party"
    })
  }, [characters, userKey, userRole])

  function addPartyItem(item: Itemmable) {
    setAppState((previous) => ({
      ...previous,
      partyInventory: [
        ...(previous.partyInventory ?? []),
        normalizeItemText(item),
      ],
    }))
  }

  function updatePartyItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    setAppState((previous) => ({
      ...previous,
      partyInventory: (previous.partyInventory ?? []).map((item) =>
        item.id === itemId
          ? normalizeItemText(updater(item))
          : item,
      ),
    }))
  }

  function removePartyItem(itemId: string) {
    setAppState((previous) => ({
      ...previous,
      partyInventory: (previous.partyInventory ?? []).filter(
        (item) => item.id !== itemId,
      ),
    }))
  }

  function transferItem(request: TransferItemRequest) {
    setAppState((previous) => {
      if (sameLocation(request.source, request.destination)) {
        return previous
      }

      const characterMap = new Map(
        previous.characters.map((rawCharacter) => {
          const character = CharacterTemplate.fromJSON(rawCharacter)
          return [character.get("id"), character] as const
        }),
      )

      assertTransferPermission(
        request.source,
        request.destination,
        characterMap,
        userRole,
        userKey,
      )

      let partyInventory = [...(previous.partyInventory ?? [])]
      const sourceInventory = getLocationInventory(
        request.source,
        partyInventory,
        characterMap,
      )
      const item = sourceInventory.find(
        (entry) => entry.id === request.itemId,
      )

      if (!item) {
        throw new Error("O item não está mais no inventário de origem.")
      }

      const availableQuantity = Math.max(0, item.quantity ?? 0)
      const requestedQuantity = Math.max(
        1,
        Math.trunc(request.quantity || 1),
      )
      const movedQuantity = Math.min(
        availableQuantity,
        requestedQuantity,
      )

      if (movedQuantity <= 0) {
        throw new Error("Não há quantidade disponível para transferir.")
      }

      const nextSourceInventory = sourceInventory.flatMap((entry) => {
        if (entry.id !== item.id) return [entry]

        const remaining = availableQuantity - movedQuantity
        return remaining > 0
          ? [{ ...entry, quantity: remaining }]
          : []
      })

      const transferredItem = normalizeItemText({
        ...item,
        id: crypto.randomUUID(),
        quantity: movedQuantity,
        insideBagOfHolding: false,
      })

      if (request.source.type === "party") {
        partyInventory = nextSourceInventory
      } else {
        const sourceCharacter = characterMap.get(
          request.source.characterId,
        )!
        characterMap.set(
          request.source.characterId,
          sourceCharacter.with("inventory", nextSourceInventory),
        )
      }

      if (request.destination.type === "party") {
        partyInventory = [...partyInventory, transferredItem]
      } else {
        const destinationCharacter = characterMap.get(
          request.destination.characterId,
        )!
        characterMap.set(
          request.destination.characterId,
          destinationCharacter.with("inventory", [
            ...destinationCharacter.get("inventory"),
            transferredItem,
          ]),
        )
      }

      return {
        ...previous,
        partyInventory,
        characters: previous.characters.map((rawCharacter) => {
          const id = CharacterTemplate.fromJSON(rawCharacter).get("id")
          return characterMap.get(id)?.toJSON() ?? rawCharacter
        }),
      }
    })
  }

  return (
    <PartyInventoryContext.Provider
      value={{
        partyInventory: appState.partyInventory ?? [],
        transferCharacters,
        addPartyItem,
        updatePartyItem,
        removePartyItem,
        transferItem,
      }}
    >
      {children}
    </PartyInventoryContext.Provider>
  )
}

export function usePartyInventoryContext() {
  const context = useContext(PartyInventoryContext)

  if (!context) {
    throw new Error(
      "usePartyInventoryContext must be used inside PartyInventoryProvider",
    )
  }

  return context
}

function sameLocation(
  left: InventoryLocation,
  right: InventoryLocation,
): boolean {
  if (left.type !== right.type) return false
  if (left.type === "party") return true
  return left.characterId === (right as { characterId: string }).characterId
}

function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  characters: Map<string, CharacterTemplate>,
): Itemmable[] {
  if (location.type === "party") return partyInventory

  const character = characters.get(location.characterId)
  if (!character) throw new Error("Personagem não encontrado.")
  return character.get("inventory") ?? []
}

function assertTransferPermission(
  source: InventoryLocation,
  destination: InventoryLocation,
  characters: Map<string, CharacterTemplate>,
  userRole: "master" | "player",
  userKey: string,
) {
  if (userRole === "master") {
    assertLocationExists(source, characters)
    assertLocationExists(destination, characters)
    return
  }

  const normalizedUserKey = userKey.trim()

  if (source.type === "character") {
    const sourceCharacter = characters.get(source.characterId)
    if (!sourceCharacter) throw new Error("Personagem de origem não encontrado.")

    if (
      sourceCharacter.get("owner")?.id?.trim() !== normalizedUserKey
    ) {
      throw new Error(
        "Você só pode retirar itens dos seus próprios personagens.",
      )
    }
  }

  if (destination.type === "character") {
    const destinationCharacter = characters.get(
      destination.characterId,
    )
    if (!destinationCharacter) {
      throw new Error("Personagem de destino não encontrado.")
    }

    const isOwner =
      destinationCharacter.get("owner")?.id?.trim() ===
      normalizedUserKey
    const isPartyVisible =
      destinationCharacter.get("visibility") === "party"

    if (!isOwner && !isPartyVisible) {
      throw new Error(
        "Esse personagem não está disponível para transferências do grupo.",
      )
    }
  }
}

function assertLocationExists(
  location: InventoryLocation,
  characters: Map<string, CharacterTemplate>,
) {
  if (
    location.type === "character" &&
    !characters.has(location.characterId)
  ) {
    throw new Error("Personagem não encontrado.")
  }
}
