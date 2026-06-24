import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { newCharacterTemplate } from "../lib/newCharacterTemplate"
import type { AppStateV1 } from "../lib/remoteState"
import { normalizeItemText } from "../lib/textNormalization"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import {
  takeLongRest,
  takePartialLongRest,
} from "../models/characters/characterRestWithSorcery"
import type { Itemmable } from "../models/items/item"
import type { Player } from "../models/player/Player"
import {
  consumeSelectedSupplies,
  getRequiredSupplyForRace,
  type LongRestSupplySelection,
} from "../models/supplies/partySupply"

export type InventoryLocation =
  | { type: "party" }
  | { type: "character"; characterId: string }

export type TransferItemRequest = {
  itemId: string
  quantity: number
  from: InventoryLocation
  to: InventoryLocation
}

export type CharacterContextValue = {
  activeCharacter?: CharacterTemplate
  visibleCharacters: CharacterTemplate[]
  transferCharacters: CharacterTemplate[]
  partyInventory: Itemmable[]
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
  completeLongRest: (
    characterId: string,
    selection: LongRestSupplySelection[],
  ) => void
  addCharacter: () => void
  importCharacter: (rawCharacter: unknown) => CharacterTemplate
  deleteCharacter: (id: string) => void
  setSelectedCharacterId: (id: string) => void
  addPartyItem: (item: Itemmable) => void
  updatePartyItem: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  removePartyItem: (itemId: string) => void
  transferItem: (request: TransferItemRequest) => void
  canTransferFromCharacter: (characterId: string) => boolean
  canViewCharacterDetails: (characterId: string) => boolean
  canAssignOwners: boolean
  canEditCharacterType: boolean
  knownPlayerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

type CharacterProviderProps = {
  children: ReactNode
  appState: AppStateV1
  setAppState: Dispatch<SetStateAction<AppStateV1>>
  userRole: "master" | "player"
  userKey: string
}

const CharacterContext = createContext<CharacterContextValue | undefined>(
  undefined,
)

export function CharacterProvider({
  children,
  appState,
  setAppState,
  userRole,
  userKey,
}: CharacterProviderProps) {
  const normalizedUserKey = userKey.trim()
  const characterObjects = useMemo(
    () =>
      appState.characters.map((character) =>
        CharacterTemplate.fromJSON(character),
      ),
    [appState.characters],
  )

  const canViewCharacter = (character: CharacterTemplate) => {
    if (userRole === "master") return true
    if (character.get("visibility") === "party") return true
    return character.get("owner")?.id?.trim() === normalizedUserKey
  }

  const visibleCharacters = characterObjects.filter(canViewCharacter)
  const transferCharacters = characterObjects
  const activeCharacter =
    visibleCharacters.find(
      (character) => character.get("id") === appState.activeCharacterId,
    ) ?? visibleCharacters[0]

  useEffect(() => {
    if (!activeCharacter) return
    if (activeCharacter.get("id") === appState.activeCharacterId) return

    setAppState((previous) => ({
      ...previous,
      activeCharacterId: activeCharacter.get("id"),
    }))
  }, [activeCharacter, appState.activeCharacterId, setAppState])

  function updateCharacter(
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) {
    setAppState((previous) => ({
      ...previous,
      characters: previous.characters.map((rawCharacter) => {
        const character = CharacterTemplate.fromJSON(rawCharacter)

        return character.get("id") === characterId
          ? updater(character).toJSON()
          : rawCharacter
      }),
    }))
  }

  function completeLongRest(
    characterId: string,
    selection: LongRestSupplySelection[],
  ) {
    setAppState((previous) => {
      const characters = previous.characters.map((rawCharacter) =>
        CharacterTemplate.fromJSON(rawCharacter),
      )
      const character = characters.find(
        (entry) => entry.get("id") === characterId,
      )

      if (!character) return previous

      const canRest =
        userRole === "master" ||
        character.get("owner")?.id?.trim() === normalizedUserKey

      if (!canRest) return previous

      const required = getRequiredSupplyForRace(
        character.get("sheet").race,
      )
      const consumption = consumeSelectedSupplies(
        previous.partyInventory ?? [],
        selection,
        required,
      )

      if (!consumption.valid) return previous

      const restedCharacter = consumption.completeRest
        ? takeLongRest(character)
        : takePartialLongRest(character)

      return {
        ...previous,
        characters: characters.map((entry) =>
          entry.get("id") === characterId
            ? restedCharacter.toJSON()
            : entry.toJSON(),
        ),
        partyInventory: consumption.items,
      }
    })
  }

  function addCharacter() {
    const owner = createOwner(normalizedUserKey || "Novo jogador")
    const character = newCharacterTemplate("Novo personagem", owner)

    setAppState((previous) => ({
      ...previous,
      characters: [...previous.characters, character.toJSON()],
      activeCharacterId: character.get("id"),
    }))
  }

  function importCharacter(rawCharacter: unknown): CharacterTemplate {
    const parsed = CharacterTemplate.fromJSON(
      rawCharacter as Partial<CharacterTemplateProps>,
    )
    const character = parsed.withPatch({
      id: parsed.get("id") || crypto.randomUUID(),
      owner:
        parsed.get("owner")?.id?.trim()
          ? parsed.get("owner")
          : createOwner(normalizedUserKey || "Novo jogador"),
    })

    setAppState((previous) => ({
      ...previous,
      characters: [
        ...previous.characters.filter(
          (entry) => entry.id !== character.get("id"),
        ),
        character.toJSON(),
      ],
      activeCharacterId: character.get("id"),
    }))

    return character
  }

  function deleteCharacter(id: string) {
    setAppState((previous) => {
      const remaining = previous.characters.filter(
        (character) => character.id !== id,
      )

      return {
        ...previous,
        characters: remaining,
        activeCharacterId:
          previous.activeCharacterId === id
            ? remaining[0]?.id ?? ""
            : previous.activeCharacterId,
      }
    })
  }

  function setSelectedCharacterId(id: string) {
    setAppState((previous) => ({
      ...previous,
      activeCharacterId: id,
    }))
  }

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
      const sourceItems = getInventoryAtLocation(previous, request.from)
      const sourceItem = sourceItems.find(
        (item) => item.id === request.itemId,
      )

      if (!sourceItem) return previous

      const availableQuantity = Math.max(0, sourceItem.quantity ?? 0)
      const requestedQuantity = Math.max(
        1,
        Math.trunc(request.quantity || 1),
      )
      const movedQuantity = Math.min(
        availableQuantity,
        requestedQuantity,
      )

      if (movedQuantity <= 0) return previous

      const remainingQuantity = availableQuantity - movedQuantity
      const nextSourceItems = sourceItems.flatMap((item) => {
        if (item.id !== request.itemId) return [item]
        if (remainingQuantity <= 0) return []

        return [
          {
            ...item,
            quantity: remainingQuantity,
          },
        ]
      })
      const destinationItems = getInventoryAtLocation(previous, request.to)
      const transferredItem: Itemmable = normalizeItemText({
        ...sourceItem,
        id: crypto.randomUUID(),
        quantity: movedQuantity,
        insideBagOfHolding: false,
      })
      const nextDestinationItems = mergeTransferredItem(
        destinationItems,
        transferredItem,
      )

      return setInventoryAtLocation(
        setInventoryAtLocation(previous, request.from, nextSourceItems),
        request.to,
        nextDestinationItems,
      )
    })
  }

  function canTransferFromCharacter(characterId: string): boolean {
    const character = characterObjects.find(
      (entry) => entry.get("id") === characterId,
    )

    if (!character) return false
    if (userRole === "master") return true
    return character.get("owner")?.id?.trim() === normalizedUserKey
  }

  function canViewCharacterDetails(characterId: string): boolean {
    const character = characterObjects.find(
      (entry) => entry.get("id") === characterId,
    )

    return character ? canViewCharacter(character) : false
  }

  const knownPlayerKeys = useMemo(() => {
    const keys = new Set<string>()

    if (normalizedUserKey) keys.add(normalizedUserKey)

    for (const character of characterObjects) {
      const ownerId = character.get("owner")?.id?.trim()
      if (ownerId) keys.add(ownerId)
    }

    return Array.from(keys)
  }, [characterObjects, normalizedUserKey])

  function getOwner(ownerId: string): Player {
    const normalizedOwnerId = ownerId.trim()
    const characterOwner = characterObjects
      .map((character) => character.get("owner"))
      .find((owner) => owner.id.trim() === normalizedOwnerId)

    return (
      characterOwner ?? {
        id: normalizedOwnerId,
        name: normalizedOwnerId,
        role: "player",
      }
    )
  }

  function createOwner(ownerName: string): Player {
    const normalizedOwnerName = ownerName.trim()
    const existing = characterObjects
      .map((character) => character.get("owner"))
      .find(
        (owner) =>
          owner.id.trim() === normalizedOwnerName ||
          owner.name.trim() === normalizedOwnerName,
      )

    return (
      existing ?? {
        id: normalizedOwnerName,
        name: normalizedOwnerName,
        role: "player",
      }
    )
  }

  const value: CharacterContextValue = {
    activeCharacter,
    visibleCharacters,
    transferCharacters,
    partyInventory: appState.partyInventory ?? [],
    updateCharacter,
    completeLongRest,
    addCharacter,
    importCharacter,
    deleteCharacter,
    setSelectedCharacterId,
    addPartyItem,
    updatePartyItem,
    removePartyItem,
    transferItem,
    canTransferFromCharacter,
    canViewCharacterDetails,
    canAssignOwners: userRole === "master",
    canEditCharacterType: userRole === "master",
    knownPlayerKeys,
    getOwner,
    createOwner,
  }

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  )
}

export function useCharacterContext(): CharacterContextValue {
  const context = useContext(CharacterContext)

  if (!context) {
    throw new Error(
      "useCharacterContext precisa estar dentro de CharacterProvider.",
    )
  }

  return context
}

function getInventoryAtLocation(
  state: AppStateV1,
  location: InventoryLocation,
): Itemmable[] {
  if (location.type === "party") return state.partyInventory ?? []

  return (
    state.characters.find(
      (character) => character.id === location.characterId,
    )?.inventory ?? []
  )
}

function setInventoryAtLocation(
  state: AppStateV1,
  location: InventoryLocation,
  items: Itemmable[],
): AppStateV1 {
  if (location.type === "party") {
    return {
      ...state,
      partyInventory: items,
    }
  }

  return {
    ...state,
    characters: state.characters.map((character) =>
      character.id === location.characterId
        ? {
            ...character,
            inventory: items,
          }
        : character,
    ),
  }
}

function mergeTransferredItem(
  items: Itemmable[],
  transferredItem: Itemmable,
): Itemmable[] {
  const matchingIndex = items.findIndex((item) =>
    canStackItems(item, transferredItem),
  )

  if (matchingIndex < 0) return [...items, transferredItem]

  return items.map((item, index) =>
    index === matchingIndex
      ? {
          ...item,
          quantity:
            (item.quantity ?? 0) +
            (transferredItem.quantity ?? 0),
        }
      : item,
  )
}

function canStackItems(left: Itemmable, right: Itemmable): boolean {
  const leftComparable = {
    ...left,
    id: "",
    quantity: 0,
    insideBagOfHolding: false,
  }
  const rightComparable = {
    ...right,
    id: "",
    quantity: 0,
    insideBagOfHolding: false,
  }

  return JSON.stringify(leftComparable) === JSON.stringify(rightComparable)
}
