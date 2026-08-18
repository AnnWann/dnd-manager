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

import type {
  SessionAttributeOperation,
  SessionDieSides,
  SessionStatOperation,
} from "../features/session-runtime/sessionProtocol"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import { newCharacterTemplate } from "../lib/newCharacterTemplate"
import type { AppStateV1 } from "../lib/remoteState"
import { getChangedCharacterDomains } from "../lib/characterDomains"
import type { CharacterDomainName } from "../lib/relationalApi"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../models/characters/CharacterTemplate"
import { getCurrentMaxHp } from "../models/characters/characterHp"
import { applyRecordedGameOperation } from "../models/game/applyGameOperation"
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
  dispatchStatOperation: (operation: SessionStatOperation) => boolean
  dispatchAttributeOperation: (operation: SessionAttributeOperation) => boolean
  updateCharacter: (characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) => void
  updateCharacterDomain: (characterId: string, domain: CharacterDomainName, updater: (c: CharacterTemplate) => CharacterTemplate) => void
  setCharacterCurrentHp: (characterId: string, value: number) => void
  setCharacterTemporaryHp: (characterId: string, value: number) => void
  damageCharacter: (characterId: string, amount: number) => void
  healCharacter: (characterId: string, amount: number) => void
  useCharacterAbility: (characterId: string, abilityId: string) => void
  restoreCharacterAbility: (characterId: string, abilityId: string) => void
  resetCharacterAbility: (characterId: string, abilityId: string) => void
  completeLongRest: (characterId: string, selection: LongRestSupplySelection[]) => void
  addCharacter: () => void
  importCharacter: (rawCharacter: unknown) => CharacterTemplate
  deleteCharacter: (id: string) => void
  setSelectedCharacterId: (id: string) => void
  addPartyItem: (item: Itemmable) => void
  updatePartyItem: (itemId: string, updater: (item: Itemmable) => Itemmable) => void
  removePartyItem: (itemId: string) => void
  addGroundItem: (item: Itemmable) => void
  updateGroundItem: (itemId: string, updater: (item: Itemmable) => Itemmable) => void
  removeGroundItem: (itemId: string) => void
  stowHandOccupant: (characterId: string, reference: HandOccupantReference) => void
  dropHandOccupant: (characterId: string, reference: HandOccupantReference) => void
  moveEquippedItem: (characterId: string, reference: EquippedItemReference, destination: EquippedItemDestination) => void
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

export function CharacterProvider({ children, appState, setAppState, userRole, userKey }: CharacterProviderProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const sessionRuntime = useOptionalSessionRuntime()

  const sourceCharacters = useMemo(
    () => appState.characters.map((character) => character instanceof CharacterTemplate ? character : CharacterTemplate.fromJSON(character)),
    [appState.characters],
  )

  const characters = useMemo(
    () => sourceCharacters.map((character) => {
      const authoritative = sessionRuntime?.hpByCharacterId[character.get("id")]
      if (!authoritative) return character

      const sheet = character.get("sheet")
      const authoritativeHitDice = Object.fromEntries(
        Object.entries(authoritative.hitDice ?? {}).flatMap(([side, pool]) =>
          pool ? [[side, {
            current: { quantity: pool.current, sides: side as SessionDieSides },
            max: { quantity: pool.max, sides: side as SessionDieSides },
          }]] : [],
        ),
      ) as typeof sheet.HP.hitDice

      return character.withPatch({
        sheet: {
          ...sheet,
          attributes: authoritative.attributesInitialized ? { ...authoritative.attributes } : sheet.attributes,
          stats: authoritative.statsInitialized ? {
            ...sheet.stats,
            armorClassAdjustment: authoritative.stats.armorClassAdjustment,
            initiativeAdjustment: authoritative.stats.initiativeAdjustment,
            mobilityAdjustment: authoritative.stats.mobilityAdjustment,
            passivePerceptionAdjustment: authoritative.stats.passivePerceptionAdjustment,
            exhaustion: authoritative.stats.exhaustion,
            inspiration: authoritative.stats.inspiration,
            experience: authoritative.stats.experience,
          } : sheet.stats,
          HP: {
            ...sheet.HP,
            current: authoritative.current,
            temporary: authoritative.temporary,
            max: authoritative.max,
            currentMax: authoritative.currentMax,
            hitDice: authoritativeHitDice,
          },
        },
      })
    }),
    [sessionRuntime?.hpByCharacterId, sourceCharacters],
  )

  const canAssignOwners = userRole === "master"
  const canEditCharacterType = userRole === "master"
  const normalizedUserKey = userKey.trim()
  const actorId = normalizedUserKey || userRole

  useEffect(() => {
    if (!sessionRuntime || sessionRuntime.status !== "connected" || sessionRuntime.role !== "MASTER" || sourceCharacters.length === 0) return

    sessionRuntime.initializeHp(sourceCharacters.map((character) => {
      const sheet = character.get("sheet")
      const hp = sheet.HP
      const currentMax = getCurrentMaxHp(character)
      const hitDice = Object.fromEntries(
        Object.entries(hp.hitDice).flatMap(([side, pool]) =>
          pool ? [[side, { current: pool.current.quantity, max: pool.max.quantity }]] : [],
        ),
      )

      return {
        characterId: character.get("id"),
        ownerUserId: character.get("owner")?.id?.trim() || undefined,
        current: hp.current,
        temporary: hp.temporary,
        max: hp.max,
        currentMax,
        maxHpBonus: character.getEffectiveMaxHp() - currentMax,
        hitDice,
        attributes: { ...sheet.attributes },
        stats: {
          armorClassAdjustment: sheet.stats.armorClassAdjustment ?? 0,
          initiativeAdjustment: sheet.stats.initiativeAdjustment ?? 0,
          mobilityAdjustment: sheet.stats.mobilityAdjustment ?? 0,
          passivePerceptionAdjustment: sheet.stats.passivePerceptionAdjustment ?? 0,
          exhaustion: sheet.stats.exhaustion ?? 0,
          inspiration: sheet.stats.inspiration ?? false,
          experience: sheet.stats.experience ?? 0,
        },
      }
    }))
  }, [sessionRuntime?.initializeHp, sessionRuntime?.role, sessionRuntime?.status, sourceCharacters])

  const playersById = useMemo(() => {
    const map = new Map<string, Player>()
    for (const character of characters) {
      const owner = character.get("owner")
      if (owner?.id) map.set(owner.id, owner)
    }
    return map
  }, [characters])

  function getOwner(ownerId: string): Player {
    return playersById.get(ownerId) ?? { id: ownerId, name: ownerId, role: "player" }
  }

  function createOwner(ownerName: string): Player {
    return { id: ownerName.trim() || crypto.randomUUID(), name: ownerName.trim() || "Novo jogador", role: "player" }
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
    const character = characters.find((entry) => entry.get("id") === characterId)
    if (!character) return false
    if (userRole === "master") return true
    const isOwned = character.get("owner")?.id?.trim() === normalizedUserKey
    return isOwned || character.get("visibility") === "party"
  }

  const visibleCharacters = useMemo(() => {
    if (userRole === "master") return characters
    if (!normalizedUserKey) return []
    return characters.filter((character) => character.get("owner")?.id?.trim() === normalizedUserKey || character.get("visibility") === "party")
  }, [characters, normalizedUserKey, userRole])

  const transferCharacters = useMemo(() => {
    if (userRole === "master") return characters
    return characters.filter((character) => character.get("owner")?.id?.trim() === normalizedUserKey || character.get("visibility") !== "master")
  }, [characters, normalizedUserKey, userRole])

  const activeCharacter = useMemo(
    () => visibleCharacters.find((character) => character.get("id") === selectedCharacterId)
      ?? visibleCharacters.find((character) => character.get("id") === appState.activeCharacterId)
      ?? visibleCharacters[0],
    [appState.activeCharacterId, selectedCharacterId, visibleCharacters],
  )

  useEffect(() => {
    if (visibleCharacters.length === 0) {
      if (selectedCharacterId !== "") setSelectedCharacterId("")
      return
    }
    const resolved = visibleCharacters.find((character) => character.get("id") === selectedCharacterId)
      ?? visibleCharacters.find((character) => character.get("id") === appState.activeCharacterId)
      ?? visibleCharacters[0]
    if (resolved && resolved.get("id") !== selectedCharacterId) setSelectedCharacterId(resolved.get("id"))
  }, [appState.activeCharacterId, selectedCharacterId, visibleCharacters])

  useEffect(() => {
    if (characters.length > 0) return
    const character = newCharacterTemplate("Meu personagem", getOwner(userKey))
    setAppState((previous) => applyRecordedGameOperation(previous, createGameOperationRecord({ type: "character.add", character: character.toJSON(), select: true }, actorId)))
    setSelectedCharacterId(character.get("id"))
  }, [actorId, characters.length, setAppState, userKey])

  function dispatchStatOperation(operation: SessionStatOperation): boolean {
    if (!sessionRuntime) return false
    if (sessionRuntime.status !== "connected") {
      console.warn("[session-runtime] Stat change ignored while the authoritative session server is disconnected.")
      return true
    }
    sessionRuntime.dispatchHpOperation(operation)
    return true
  }

  function dispatchAttributeOperation(operation: SessionAttributeOperation): boolean {
    if (!sessionRuntime) return false
    if (sessionRuntime.status !== "connected") {
      console.warn("[session-runtime] Attribute change ignored while the authoritative session server is disconnected.")
      return true
    }
    sessionRuntime.dispatchHpOperation(operation)
    return true
  }

  function dispatchGameOperation(operation: GameOperation) {
    if (sessionRuntime && isAuthoritativeHpOperation(operation)) {
      if (sessionRuntime.status !== "connected") {
        console.warn("[session-runtime] HP change ignored while the authoritative session server is disconnected.")
        return
      }
      sessionRuntime.dispatchHpOperation(operation)
      return
    }
    setAppState((previous) => applyRecordedGameOperation(previous, createGameOperationRecord(operation, actorId)))
  }

  function updateCharacter(characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate) { replaceCharacter(characterId, updater) }
  function updateCharacterDomain(characterId: string, domain: CharacterDomainName, updater: (c: CharacterTemplate) => CharacterTemplate) { replaceCharacter(characterId, updater, domain) }

  function replaceCharacter(characterId: string, updater: (c: CharacterTemplate) => CharacterTemplate, declaredDomain?: CharacterDomainName) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find((entry) => entry.id === characterId)
      if (!rawCharacter) return previous
      const character = CharacterTemplate.fromJSON(rawCharacter)
      const nextCharacter = updater(character)
      if (declaredDomain) {
        const changedDomains = getChangedCharacterDomains(character.toJSON(), nextCharacter.toJSON())
        const unexpected = changedDomains.filter((changedDomain) => changedDomain !== declaredDomain)
        if (unexpected.length) console.warn(`Updater de ${declaredDomain} alterou domínios fora do ownership: ${unexpected.join(", ")}.`)
      }
      return applyRecordedGameOperation(previous, createGameOperationRecord({ type: "character.replace", characterId, character: nextCharacter.toJSON() }, actorId))
    })
  }

  function setCharacterCurrentHp(characterId: string, value: number) { dispatchGameOperation({ type: "character.hp.set", characterId, value }) }
  function setCharacterTemporaryHp(characterId: string, value: number) { dispatchGameOperation({ type: "character.hp.temporary.set", characterId, value }) }
  function damageCharacter(characterId: string, amount: number) { dispatchGameOperation({ type: "character.hp.damage", characterId, amount }) }
  function healCharacter(characterId: string, amount: number) { dispatchGameOperation({ type: "character.hp.heal", characterId, amount }) }
  function useCharacterAbility(characterId: string, abilityId: string) { dispatchGameOperation({ type: "character.ability.use", characterId, abilityId }) }
  function restoreCharacterAbility(characterId: string, abilityId: string) { dispatchGameOperation({ type: "character.ability.restore", characterId, abilityId }) }
  function resetCharacterAbility(characterId: string, abilityId: string) { dispatchGameOperation({ type: "character.ability.reset", characterId, abilityId }) }

  function completeLongRest(characterId: string, selection: LongRestSupplySelection[]) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find((entry) => entry.id === characterId)
      if (!rawCharacter) return previous
      const restedCharacter = CharacterTemplate.fromJSON(rawCharacter)
      const canRest = userRole === "master" || restedCharacter.get("owner")?.id?.trim() === normalizedUserKey
      if (!canRest) return previous
      const previousSheet = restedCharacter.get("sheet")
      const previousHp = previousSheet.HP
      const previousStats = previousSheet.stats
      const applied = applyRecordedGameOperation(previous, createGameOperationRecord({ type: "character.longRest.complete", characterId, selection }, actorId))
      if (!sessionRuntime) return applied
      return {
        ...applied,
        characters: applied.characters.map((entry) => {
          if (entry.id !== characterId) return entry
          const nextCharacter = CharacterTemplate.fromJSON(entry)
          const nextSheet = nextCharacter.get("sheet")
          return nextCharacter.withPatch({ sheet: { ...nextSheet, stats: previousStats, HP: { ...nextSheet.HP, current: previousHp.current, temporary: previousHp.temporary, hitDice: previousHp.hitDice } } }).toJSON()
        }),
      }
    })
  }

  function addCharacter() {
    const character = newCharacterTemplate(`Personagem ${characters.length + 1}`, getOwner(userKey))
    dispatchGameOperation({ type: "character.add", character: character.toJSON(), select: true })
    setSelectedCharacterId(character.get("id"))
  }

  function importCharacter(rawCharacter: unknown): CharacterTemplate {
    if (!rawCharacter || typeof rawCharacter !== "object" || Array.isArray(rawCharacter)) throw new Error("O arquivo não contém um personagem válido.")
    const restored = CharacterTemplate.fromJSON(rawCharacter as Partial<CharacterTemplateProps>)
    const importedOwner = userRole === "master" ? restored.get("owner") : getOwner(userKey)
    const imported = restored.withPatch({ id: crypto.randomUUID(), owner: importedOwner })
    dispatchGameOperation({ type: "character.add", character: imported.toJSON(), select: true })
    setSelectedCharacterId(imported.get("id"))
    return imported
  }

  function deleteCharacter(characterId: string) {
    dispatchGameOperation({ type: "character.delete", characterId })
    setSelectedCharacterId((current) => current === characterId ? "" : current)
  }

  function addPartyItem(item: Itemmable) { dispatchGameOperation({ type: "party.item.add", item }) }
  function updatePartyItem(itemId: string, updater: (item: Itemmable) => Itemmable) {
    setAppState((previous) => {
      const item = (previous.partyInventory ?? []).find((entry) => entry.id === itemId)
      if (!item) return previous
      return applyRecordedGameOperation(previous, createGameOperationRecord({ type: "party.item.update", itemId, item: updater(item) }, actorId))
    })
  }
  function removePartyItem(itemId: string) { dispatchGameOperation({ type: "party.item.remove", itemId }) }
  function addGroundItem(item: Itemmable) { dispatchGameOperation({ type: "ground.item.add", item }) }
  function updateGroundItem(itemId: string, updater: (item: Itemmable) => Itemmable) {
    setAppState((previous) => {
      const item = (previous.groundInventory ?? []).find((entry) => entry.id === itemId)
      if (!item) return previous
      return applyRecordedGameOperation(previous, createGameOperationRecord({ type: "ground.item.update", itemId, item: updater(item) }, actorId))
    })
  }
  function removeGroundItem(itemId: string) { dispatchGameOperation({ type: "ground.item.remove", itemId }) }

  function stowHandOccupant(characterId: string, reference: HandOccupantReference) {
    updateCharacterDomain(characterId, "equipment", (current) => stowCharacterHandOccupant(current, reference))
  }

  function dropHandOccupant(characterId: string, reference: HandOccupantReference) {
    setAppState((previous) => {
      const rawCharacter = previous.characters.find((entry) => entry.id === characterId)
      if (!rawCharacter) return previous
      const removed = removeHandOccupant(CharacterTemplate.fromJSON(rawCharacter), reference)
      if (!removed.item) return previous
      const withCharacter = applyRecordedGameOperation(previous, createGameOperationRecord({ type: "character.replace", characterId, character: removed.character.toJSON() }, actorId))
      return applyRecordedGameOperation(withCharacter, createGameOperationRecord({ type: "ground.item.add", item: { ...removed.item, insideBagOfHolding: false } }, actorId))
    })
  }

  function moveEquippedItem(characterId: string, reference: EquippedItemReference, destination: EquippedItemDestination) {
    if (destination !== "ground") {
      updateCharacterDomain(characterId, "equipment", (current) => moveEquippedItemToCharacterStorage(current, reference, destination))
      return
    }
    setAppState((previous) => {
      const rawCharacter = previous.characters.find((entry) => entry.id === characterId)
      if (!rawCharacter) return previous
      const removed = removeAnyEquippedItem(CharacterTemplate.fromJSON(rawCharacter), reference)
      if (!removed.item) return previous
      const withCharacter = applyRecordedGameOperation(previous, createGameOperationRecord({ type: "character.replace", characterId, character: removed.character.toJSON() }, actorId))
      return applyRecordedGameOperation(withCharacter, createGameOperationRecord({ type: "ground.item.add", item: { ...removed.item, heldHands: undefined, insideBagOfHolding: false } }, actorId))
    })
  }

  function canTransferFromCharacter(characterId: string): boolean {
    if (userRole === "master") return true
    return characters.some((character) => character.get("id") === characterId && character.get("owner")?.id?.trim() === normalizedUserKey)
  }

  function transferItem(request: TransferItemRequest) {
    if (locationKey(request.from) === locationKey(request.to)) return
    setAppState((previous) => {
      const characterById = new Map(previous.characters.map((rawCharacter) => [rawCharacter.id, CharacterTemplate.fromJSON(rawCharacter)]))
      if (request.from.type === "character" && !canUseCharacterAsSource(characterById.get(request.from.characterId), userRole, normalizedUserKey)) return previous
      if (request.to.type === "character" && !canUseCharacterAsTarget(characterById.get(request.to.characterId), userRole, normalizedUserKey)) return previous
      return applyRecordedGameOperation(previous, createGameOperationRecord({ type: "inventory.item.transfer", request: { ...request, destinationItemId: crypto.randomUUID() } }, actorId))
    })
  }

  const operationLog = sessionRuntime ? (appState.operations ?? []).filter((record) => !isAuthoritativeHpOperation(record.operation)) : appState.operations ?? []

  return (
    <CharacterContext.Provider value={{
      activeCharacter, visibleCharacters, transferCharacters,
      partyInventory: appState.partyInventory ?? [], groundInventory: appState.groundInventory ?? [], operationLog,
      dispatchGameOperation, dispatchStatOperation, dispatchAttributeOperation,
      updateCharacter, updateCharacterDomain,
      setCharacterCurrentHp, setCharacterTemporaryHp, damageCharacter, healCharacter,
      useCharacterAbility, restoreCharacterAbility, resetCharacterAbility, completeLongRest,
      addCharacter, importCharacter, deleteCharacter, setSelectedCharacterId,
      addPartyItem, updatePartyItem, removePartyItem, addGroundItem, updateGroundItem, removeGroundItem,
      stowHandOccupant, dropHandOccupant, moveEquippedItem, transferItem,
      canTransferFromCharacter, canViewCharacterDetails, canAssignOwners, canEditCharacterType,
      knownPlayerKeys, getOwner, createOwner,
    }}>{children}</CharacterContext.Provider>
  )
}

function isAuthoritativeHpOperation(operation: GameOperation): operation is Extract<GameOperation, { type: "character.hp.set" | "character.hp.temporary.set" | "character.hp.damage" | "character.hp.heal" }> {
  return operation.type === "character.hp.set" || operation.type === "character.hp.temporary.set" || operation.type === "character.hp.damage" || operation.type === "character.hp.heal"
}

function locationKey(location: InventoryLocation): string {
  if (location.type === "party") return "party"
  if (location.type === "ground") return "ground"
  return `character:${location.characterId}`
}

function canUseCharacterAsSource(character: CharacterTemplate | undefined, userRole: "master" | "player", userKey: string): boolean {
  if (!character) return false
  if (userRole === "master") return true
  return character.get("owner")?.id?.trim() === userKey
}

function canUseCharacterAsTarget(character: CharacterTemplate | undefined, userRole: "master" | "player", userKey: string): boolean {
  if (!character) return false
  if (userRole === "master") return true
  const isOwned = character.get("owner")?.id?.trim() === userKey
  return isOwned || character.get("visibility") !== "master"
}

export function useCharacterContext() {
  const context = useContext(CharacterContext)
  if (!context) throw new Error("useCharacterContext must be used inside CharacterProvider")
  return context
}
