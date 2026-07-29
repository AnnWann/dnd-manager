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
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import {
  applyRecordedGameOperation,
} from "../models/game/applyGameOperation"
import {
  createGameOperationRecord,
  type GameOperation,
  type GameOperationRecord,
  type InventoryLocation,
  type TransferItemOperationRequest,
} from "../models/game/GameOperation"
import type { Itemmable } from "../models/items/item"
import {
  removeHandOccupant,
  stowHandOccupant as stowCharacterHandOccupant,
  type HandOccupantReference,
} from "../models/characters/characterHands"
import {
  moveEquippedItemToCharacterStorage,
  removeEquippedItem as removeAnyEquippedItem,
  type EquippedItemDestination,
  type EquippedItemReference,
} from "../models/characters/characterEquippedItemMovement"
import type { Player } from "../models/player/Player"
import type { LongRestSupplySelection } from "../models/supplies/partySupply"

export type { InventoryLocation } from "../models/game/GameOperation"

export type TransferItemRequest = TransferItemOperationRequest

export type CharacterContextValue = {
  activeCharacter?: CharacterTemplate
  visibleCharacters: CharacterTemplate[]
  transferCharacters: CharacterTemplate[]
  partyInventory: Itemmable[]
  groundInventory: Itemmable[]
  operationLog: GameOperationRecord[]
  dispatchGameOperation: (operation: GameOperation) => void
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
  setCharacterCurrentHp: (characterId: string, value: number) => void
  setCharacterTemporaryHp: (characterId: string, value: number) => void
  damageCharacter: (characterId: string, amount: number) => void
  healCharacter: (characterId: string, amount: number) => void
  useCharacterAbility: (characterId: string, abilityId: string) => void
  restoreCharacterAbility: (characterId: string, abilityId: string) => void
  resetCharacterAbility: (characterId: string, abilityId: string) => void
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
  addGroundItem: (item: Itemmable) => void
  updateGroundItem: (
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) => void
  removeGroundItem: (itemId: string) => void
  stowHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  dropHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  moveEquippedItem: (
    characterId: string,
    reference: EquippedItemReference,
    destination: EquippedItemDestination,
  ) => void
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
  const actorId = normalizedUserKey || userRole

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

  function canViewCharacterDetails(characterId: string): boolean {
    const character = characters.find(
      (entry) => entry.get("id") === characterId,
    )
    if (!character) return false
    if (userRole === "master") return true

    const isOwned =
      character.get("owner")?.id?.trim() === normalizedUserKey
    return isOwned || character.get("visibility") === "party"
  }

  const visibleCharacters = useMemo(() => {
    if (userRole === "master") return characters
    if (!normalizedUserKey) return []

    return characters.filter((character) => {
      const isOwned =
        character.get("owner")?.id?.trim() === normalizedUserKey
      return isOwned || character.get("visibility") === "party"
    })
  }, [characters, normalizedUserKey, userRole])

  const transferCharacters = useMemo(() => {
    if (userRole === "master") return characters

    return characters.filter((character) => {
      const isOwned =
        character.get("owner")?.id?.trim() === normalizedUserKey
      return isOwned || character.get("visibility") !== "master"
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

    setAppState((previous) =>
      applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.add",
            character: character.toJSON(),
            select: true,
          },
          actorId,
        ),
      ),
    )
    setSelectedCharacterId(character.get("id"))
  }, [actorId, characters.length, setAppState, userKey])

  function dispatchGameOperation(operation: GameOperation) {
    setAppState((previous) =>
      applyRecordedGameOperation(
        previous,
        createGameOperationRecord(operation, actorId),
      ),
    )
  }

  function updateCharacter(
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const character = CharacterTemplate.fromJSON(rawCharacter)
      const nextCharacter = updater(character)

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.replace",
            characterId,
            character: nextCharacter.toJSON(),
          },
          actorId,
        ),
      )
    })
  }

  function setCharacterCurrentHp(characterId: string, value: number) {
    dispatchGameOperation({ type: "character.hp.set", characterId, value })
  }

  function setCharacterTemporaryHp(characterId: string, value: number) {
    dispatchGameOperation({
      type: "character.hp.temporary.set",
      characterId,
      value,
    })
  }

  function damageCharacter(characterId: string, amount: number) {
    dispatchGameOperation({ type: "character.hp.damage", characterId, amount })
  }

  function healCharacter(characterId: string, amount: number) {
    dispatchGameOperation({ type: "character.hp.heal", characterId, amount })
  }

  function useCharacterAbility(characterId: string, abilityId: string) {
    dispatchGameOperation({
      type: "character.ability.use",
      characterId,
      abilityId,
    })
  }

  function restoreCharacterAbility(characterId: string, abilityId: string) {
    dispatchGameOperation({
      type: "character.ability.restore",
      characterId,
      abilityId,
    })
  }

  function resetCharacterAbility(characterId: string, abilityId: string) {
    dispatchGameOperation({
      type: "character.ability.reset",
      characterId,
      abilityId,
    })
  }

  function completeLongRest(
    characterId: string,
    selection: LongRestSupplySelection[],
  ) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const restedCharacter = CharacterTemplate.fromJSON(rawCharacter)
      const canRest =
        userRole === "master" ||
        restedCharacter.get("owner")?.id?.trim() === normalizedUserKey

      if (!canRest) return previous

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.longRest.complete",
            characterId,
            selection,
          },
          actorId,
        ),
      )
    })
  }

  function addCharacter() {
    const character = newCharacterTemplate(
      `Personagem ${characters.length + 1}`,
      getOwner(userKey),
    )

    dispatchGameOperation({
      type: "character.add",
      character: character.toJSON(),
      select: true,
    })
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

    dispatchGameOperation({
      type: "character.add",
      character: imported.toJSON(),
      select: true,
    })
    setSelectedCharacterId(imported.get("id"))
    return imported
  }

  function deleteCharacter(characterId: string) {
    dispatchGameOperation({ type: "character.delete", characterId })

    setSelectedCharacterId((current) =>
      current === characterId ? "" : current,
    )
  }

  function addPartyItem(item: Itemmable) {
    dispatchGameOperation({ type: "party.item.add", item })
  }

  function updatePartyItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    setAppState((previous) => {
      const item = (previous.partyInventory ?? []).find(
        (entry) => entry.id === itemId,
      )
      if (!item) return previous

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "party.item.update",
            itemId,
            item: updater(item),
          },
          actorId,
        ),
      )
    })
  }

  function removePartyItem(itemId: string) {
    dispatchGameOperation({ type: "party.item.remove", itemId })
  }

  function addGroundItem(item: Itemmable) {
    dispatchGameOperation({ type: "ground.item.add", item })
  }

  function updateGroundItem(
    itemId: string,
    updater: (item: Itemmable) => Itemmable,
  ) {
    setAppState((previous) => {
      const item = (previous.groundInventory ?? []).find(
        (entry) => entry.id === itemId,
      )
      if (!item) return previous

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "ground.item.update",
            itemId,
            item: updater(item),
          },
          actorId,
        ),
      )
    })
  }

  function removeGroundItem(itemId: string) {
    dispatchGameOperation({ type: "ground.item.remove", itemId })
  }

  function stowHandOccupant(
    characterId: string,
    reference: HandOccupantReference,
  ) {
    updateCharacter(characterId, (current) =>
      stowCharacterHandOccupant(current, reference),
    )
  }

  function dropHandOccupant(
    characterId: string,
    reference: HandOccupantReference,
  ) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const removed = removeHandOccupant(
        CharacterTemplate.fromJSON(rawCharacter),
        reference,
      )
      if (!removed.item) return previous

      const withCharacter = applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.replace",
            characterId,
            character: removed.character.toJSON(),
          },
          actorId,
        ),
      )

      return applyRecordedGameOperation(
        withCharacter,
        createGameOperationRecord(
          {
            type: "ground.item.add",
            item: {
              ...removed.item,
              insideBagOfHolding: false,
            },
          },
          actorId,
        ),
      )
    })
  }


  function moveEquippedItem(
    characterId: string,
    reference: EquippedItemReference,
    destination: EquippedItemDestination,
  ) {
    if (destination !== "ground") {
      updateCharacter(characterId, (current) =>
        moveEquippedItemToCharacterStorage(
          current,
          reference,
          destination,
        ),
      )
      return
    }

    setAppState((previous) => {
      const rawCharacter = previous.characters.find(
        (entry) => entry.id === characterId,
      )
      if (!rawCharacter) return previous

      const removed = removeAnyEquippedItem(
        CharacterTemplate.fromJSON(rawCharacter),
        reference,
      )
      if (!removed.item) return previous

      const withCharacter = applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "character.replace",
            characterId,
            character: removed.character.toJSON(),
          },
          actorId,
        ),
      )

      return applyRecordedGameOperation(
        withCharacter,
        createGameOperationRecord(
          {
            type: "ground.item.add",
            item: {
              ...removed.item,
              heldHands: undefined,
              insideBagOfHolding: false,
            },
          },
          actorId,
        ),
      )
    })
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
      const characterById = new Map(
        previous.characters.map((rawCharacter) => [
          rawCharacter.id,
          CharacterTemplate.fromJSON(rawCharacter),
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

      return applyRecordedGameOperation(
        previous,
        createGameOperationRecord(
          {
            type: "inventory.item.transfer",
            request: {
              ...request,
              destinationItemId: crypto.randomUUID(),
            },
          },
          actorId,
        ),
      )
    })
  }

  return (
    <CharacterContext.Provider
      value={{
        activeCharacter,
        visibleCharacters,
        transferCharacters,
        partyInventory: appState.partyInventory ?? [],
        groundInventory: appState.groundInventory ?? [],
        operationLog: appState.operations ?? [],
        dispatchGameOperation,
        updateCharacter,
        setCharacterCurrentHp,
        setCharacterTemporaryHp,
        damageCharacter,
        healCharacter,
        useCharacterAbility,
        restoreCharacterAbility,
        resetCharacterAbility,
        completeLongRest,
        addCharacter,
        importCharacter,
        deleteCharacter,
        setSelectedCharacterId,
        addPartyItem,
        updatePartyItem,
        removePartyItem,
        addGroundItem,
        updateGroundItem,
        removeGroundItem,
        stowHandOccupant,
        dropHandOccupant,
        moveEquippedItem,
        transferItem,
        canTransferFromCharacter,
        canViewCharacterDetails,
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
  if (location.type === "party") return "party"
  if (location.type === "ground") return "ground"
  return `character:${location.characterId}`
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

  const isOwned = character.get("owner")?.id?.trim() === userKey
  return isOwned || character.get("visibility") !== "master"
}

export function useCharacterContext() {
  const context = useContext(CharacterContext)
  if (!context) {
    throw new Error("useCharacterContext must be used inside CharacterProvider")
  }
  return context
}
