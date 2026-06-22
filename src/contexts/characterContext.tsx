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
import { takeLongRest } from "../models/characters/characterRest"
import type { Itemmable } from "../models/items/item"
import type { Player } from "../models/player/Player"
import {
  consumeSelectedSupplies,
  getEffectiveRaceSupplyConsumption,
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

const CharacterContext = createContext<CharacterContextValue | null>(null)

export function CharacterProvider({
  children,
  appState,
  setAppState,
  userRole,
  userKey,
}: CharacterProviderProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState("")

  const characters = useMemo(
    () =>
      appState.characters.map((character) =>
        character instanceof CharacterTemplate
          ? character
          : CharacterTemplate.fromJSON(character),
      ),
    [appState.characters],
  )

  const canAssignOwners = userRole === "master"
  const canEditCharacterType = userRole === "master"
  const normalizedUserKey = userKey.trim()

  const playersById = useMemo(() => {
    const map = new Map<string, Player>()
    for (const character of characters) {
      const owner = character.get("owner")
      if (owner?.id) map.set(owner.id, owner)
    }
    return map
  }, [characters])

  function getOwner(ownerId: string): Player {
    return playersById.get(ownerId) ?? {
      id: ownerId,
      name: ownerId,
      role: "player",
    }
  }

  function createOwner(ownerName: string): Player {
    return {
      id: ownerName.trim() || crypto.randomUUID(),
      name: ownerName.trim() || "Novo jogador",
      role: "player",
    }
  }

  const knownPlayerKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const character of characters) {
      const ownerId = character.get("owner")?.id?.trim()
      if (ownerId) keys.add(ownerId)
    }
    if (normalizedUserKey) keys.add(normalizedUserKey)
    return Array.from(keys).sort((left, right) => left.localeCompare(right))
  }, [characters, normalizedUserKey])

  const visibleCharacters = useMemo(() => {
    if (userRole === "master") return characters
    if (!normalizedUserKey) return []

    return characters.filter(
      (character) =>
        character.get("owner")?.id?.trim() === normalizedUserKey,
    )
  }, [characters, normalizedUserKey, userRole])

  const transferCharacters = useMemo(() => {
    if (userRole === "master") return characters

    return characters.filter((character) => {
      const isOwned =
        character.get("owner")?.id?.trim() === normalizedUserKey
      return isOwned || character.get("visibility") === "party"
    })
  }, [characters, normalizedUserKey, userRole])

  const activeCharacter = useMemo(
    () =>
      visibleCharacters.find(
        (character) => character.get("id") === selectedCharacterId,
      ) ??
      visibleCharacters.find(
        (character) =>
          character.get("id") === appState.activeCharacterId,
      ) ??
      visibleCharacters[0],
    [appState.activeCharacterId, selectedCharacterId, visibleCharacters],
  )

  useEffect(() => {
    if (visibleCharacters.length === 0) {
      if (selectedCharacterId !== "") setSelectedCharacterId("")
      return
    }

    const resolved =
      visibleCharacters.find(
        (character) => character.get("id") === selectedCharacterId,
      ) ??
      visibleCharacters.find(
        (character) =>
          character.get("id") === appState.activeCharacterId,
      ) ??
      visibleCharacters[0]

    if (resolved && resolved.get("id") !== selectedCharacterId) {
      setSelectedCharacterId(resolved.get("id"))
    }
  }, [appState.activeCharacterId, selectedCharacterId, visibleCharacters])

  useEffect(() => {
    if (characters.length > 0) return

    const character = newCharacterTemplate(
      "Meu personagem",
      getOwner(userKey),
    )

    setAppState((previous) => ({
      ...previous,
      characters: [character.toJSON()],
      activeCharacterId: character.get("id"),
    }))
    setSelectedCharacterId(character.get("id"))
  }, [characters.length, setAppState, userKey])

  function updateCharacter(
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) {
    setAppState((previous) => ({
      ...previous,
      characters: previous.characters.map((rawCharacter) => {
        const character = CharacterTemplate.fromJSON(rawCharacter)

        if (character.get("id") !== characterId) {
          return character.toJSON()
        }

        return updater(character).toJSON()
      }),
    }))
  }

  function completeLongRest(
    characterId: string,
    selection: LongRestSupplySelection[],
  ) {
    setAppState((previous) => {
      const characterObjects = previous.characters.map((rawCharacter) =>
        CharacterTemplate.fromJSON(rawCharacter),
      )
      const restedCharacter = characterObjects.find(
        (character) => character.get("id") === characterId,
      )

      if (!restedCharacter) return previous

      const canRest =
        userRole === "master" ||
        restedCharacter.get("owner")?.id?.trim() === normalizedUserKey

      if (!canRest) return previous

      const required = getEffectiveRaceSupplyConsumption(
        restedCharacter.get("sheet").race,
      )
      const consumption = consumeSelectedSupplies(
        previous.partyInventory ?? [],
        selection,
        required.food,
        required.drink,
      )

      if (!consumption.valid) return previous

      return {
        ...previous,
        characters: characterObjects.map((character) =>
          character.get("id") === characterId
            ? takeLongRest(character).toJSON()
            : character.toJSON(),
        ),
        partyInventory: consumption.items,
      }
    })
  }

  function addCharacter() {
    const character = newCharacterTemplate(
      `Personagem ${characters.length + 1}`,
      getOwner(userKey),
    )

    setAppState((previous) => ({
      ...previous,
      characters: [...previous.characters, character.toJSON()],
      activeCharacterId: character.get("id"),
    }))
    setSelectedCharacterId(character.get("id"))
  }

  function importCharacter(rawCharacter: unknown): CharacterTemplate {
    if (
      !rawCharacter ||
      typeof rawCharacter !== "object" ||
      Array.isArray(rawCharacter)
    ) {
      throw new Error("O arquivo não contém um personagem válido.")
    }

    const restored = CharacterTemplate.fromJSON(
      rawCharacter as Partial<CharacterTemplateProps>,
    )
    const importedOwner =
      userRole === "master"
        ? restored.get("owner")
        : getOwner(userKey)
    const imported = restored.withPatch({
      id: crypto.randomUUID(),
      owner: importedOwner,
    })

    setAppState((previous) => ({
      ...previous,
      characters: [...previous.characters, imported.toJSON()],
      activeCharacterId: imported.get("id"),
    }))
    setSelectedCharacterId(imported.get("id"))
    return imported
  }

  function deleteCharacter(characterId: string) {
    setAppState((previous) => ({
      ...previous,
      characters: previous.characters.filter(
        (rawCharacter) => rawCharacter.id !== characterId,
      ),
    }))

    setSelectedCharacterId((current) =>
      current === characterId ? "" : current,
    )
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

  function canTransferFromCharacter(characterId: string): boolean {
    if (userRole === "master") return true

    return characters.some(
      (character) =>
        character.get("id") === characterId &&
        character.get("owner")?.id?.trim() === normalizedUserKey,
    )
  }

  function transferItem(request: TransferItemRequest) {
    if (locationKey(request.from) === locationKey(request.to)) return

    setAppState((previous) => {
      const characterObjects = previous.characters.map((raw) =>
        CharacterTemplate.fromJSON(raw),
      )
      const characterById = new Map(
        characterObjects.map((character) => [
          character.get("id"),
          character,
        ]),
      )

      if (
        request.from.type === "character" &&
        !canUseCharacterAsSource(
          characterById.get(request.from.characterId),
          userRole,
          normalizedUserKey,
        )
      ) {
        return previous
      }

      if (
        request.to.type === "character" &&
        !canUseCharacterAsTarget(
          characterById.get(request.to.characterId),
          userRole,
          normalizedUserKey,
        )
      ) {
        return previous
      }

      const partyInventory = [...(previous.partyInventory ?? [])]
      const inventoryByCharacterId = new Map(
        characterObjects.map((character) => [
          character.get("id"),
          [...(character.get("inventory") ?? [])],
        ]),
      )

      const sourceInventory = getLocationInventory(
        request.from,
        partyInventory,
        inventoryByCharacterId,
      )
      const destinationInventory = getLocationInventory(
        request.to,
        partyInventory,
        inventoryByCharacterId,
      )

      if (!sourceInventory || !destinationInventory) return previous

      const itemIndex = sourceInventory.findIndex(
        (item) => item.id === request.itemId,
      )
      if (itemIndex < 0) return previous

      const sourceItem = sourceInventory[itemIndex]
      const availableQuantity = Math.max(
        0,
        Number(sourceItem.quantity) || 0,
      )
      if (availableQuantity <= 0) return previous

      const requestedQuantity = Math.max(
        1,
        Math.trunc(Number(request.quantity) || availableQuantity),
      )
      const movedQuantity = Math.min(
        availableQuantity,
        requestedQuantity,
      )

      if (movedQuantity >= availableQuantity) {
        sourceInventory.splice(itemIndex, 1)
      } else {
        sourceInventory[itemIndex] = normalizeItemText({
          ...sourceItem,
          quantity: availableQuantity - movedQuantity,
        })
      }

      destinationInventory.push(
        normalizeItemText({
          ...sourceItem,
          id: crypto.randomUUID(),
          quantity: movedQuantity,
          insideBagOfHolding: false,
        }),
      )

      return {
        ...previous,
        partyInventory,
        characters: characterObjects.map((character) =>
          character
            .with(
              "inventory",
              inventoryByCharacterId.get(character.get("id")) ?? [],
            )
            .toJSON(),
        ),
      }
    })
  }

  return (
    <CharacterContext.Provider
      value={{
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
        canAssignOwners,
        canEditCharacterType,
        knownPlayerKeys,
        getOwner,
        createOwner,
      }}
    >
      {children}
    </CharacterContext.Provider>
  )
}

function locationKey(location: InventoryLocation): string {
  return location.type === "party"
    ? "party"
    : `character:${location.characterId}`
}

function canUseCharacterAsSource(
  character: CharacterTemplate | undefined,
  userRole: "master" | "player",
  userKey: string,
): boolean {
  if (!character) return false
  if (userRole === "master") return true

  return character.get("owner")?.id?.trim() === userKey
}

function canUseCharacterAsTarget(
  character: CharacterTemplate | undefined,
  userRole: "master" | "player",
  userKey: string,
): boolean {
  if (!character) return false
  if (userRole === "master") return true

  return (
    character.get("owner")?.id?.trim() === userKey ||
    character.get("visibility") === "party"
  )
}

function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  inventoryByCharacterId: Map<string, Itemmable[]>,
): Itemmable[] | undefined {
  if (location.type === "party") return partyInventory
  return inventoryByCharacterId.get(location.characterId)
}

export function useCharacterContext() {
  const context = useContext(CharacterContext)
  if (!context) {
    throw new Error("useCharacterContext must be used inside CharacterProvider")
  }
  return context
}
