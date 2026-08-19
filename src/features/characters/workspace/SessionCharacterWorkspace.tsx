import { useCallback, useEffect, useMemo, type ReactNode } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { EquippedItemReference } from "../../../models/characters/characterEquippedItemMovement"
import type { Itemmable } from "../../../models/items/item"
import { applySessionAbilityState } from "../../session-runtime/applySessionAbilityState"
import type { SessionEquipmentOperation } from "../../session-runtime/equipmentSessionProtocol"
import type { SessionMagicOperation } from "../../session-runtime/magicSessionProtocol"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"
import {
  CharacterWorkspaceProvider,
  type CharacterWorkspaceValue,
} from "./CharacterWorkspaceContext"

export function SessionCharacterWorkspace({ children }: { children: ReactNode }) {
  const characterContext = useCharacterContext()
  const sessionRuntime = useOptionalSessionRuntime()
  const { userKey } = useSyncContext()

  useEffect(() => {
    if (!sessionRuntime || sessionRuntime.status !== "connected" || sessionRuntime.role !== "MASTER" || characterContext.visibleCharacters.length === 0) return
    sessionRuntime.initializeAbilities(characterContext.visibleCharacters.map((character) => ({
      characterId: character.get("id"),
      character: character.toJSON(),
    })))
  }, [characterContext.visibleCharacters, sessionRuntime?.initializeAbilities, sessionRuntime?.role, sessionRuntime?.status])

  const projectedCharacters = useMemo(
    () => characterContext.visibleCharacters.map((character) =>
      applySessionAbilityState(character, sessionRuntime?.abilitiesByCharacterId[character.get("id")]),
    ),
    [characterContext.visibleCharacters, sessionRuntime?.abilitiesByCharacterId],
  )

  const projectedActiveCharacter = useMemo(() => {
    const activeId = characterContext.activeCharacter?.get("id")
    if (!activeId) return undefined
    return projectedCharacters.find((character) => character.get("id") === activeId)
  }, [characterContext.activeCharacter, projectedCharacters])

  const updateCharacter = useCallback((
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => {
    if (!sessionRuntime) {
      characterContext.updateCharacter(characterId, updater)
      return
    }

    const current = projectedCharacters.find((character) => character.get("id") === characterId)
    if (!current) return
    const next = updater(current)

    const magicChanged = JSON.stringify(current.get("magic")) !== JSON.stringify(next.get("magic"))
    const equipmentChanged = JSON.stringify(current.get("equipment")) !== JSON.stringify(next.get("equipment"))

    if (equipmentChanged) {
      const equipmentOperations = deriveEquipmentOperations(current, next)
      if (!equipmentOperations.length) {
        console.warn("[session-runtime] blocked an unrecognized local equipment mutation", { characterId })
        return
      }
      for (const operation of equipmentOperations) sessionRuntime.dispatchEquipmentOperation(operation)
      return
    }

    if (magicChanged) {
      const operations = deriveMagicOperations(current, next)
      if (!operations.length) {
        console.warn("[session-runtime] blocked an unrecognized local magic mutation", { characterId })
        return
      }
      for (const operation of operations) sessionRuntime.dispatchMagicOperation(operation)
      return
    }

    characterContext.updateCharacter(characterId, updater)
  }, [characterContext, projectedCharacters, sessionRuntime])

  const owners = characterContext.knownPlayerKeys.map((key) => characterContext.getOwner(key))
  const normalizedUserKey = userKey.trim()
  const currentOwner = normalizedUserKey ? characterContext.getOwner(normalizedUserKey) : undefined

  const value: CharacterWorkspaceValue = {
    mode: "campaign",
    characters: projectedCharacters,
    activeCharacter: projectedActiveCharacter,
    selectedCharacterId: projectedActiveCharacter?.get("id"),
    setSelectedCharacterId: characterContext.setSelectedCharacterId,
    updateCharacter,
    updateCharacterDomain: characterContext.updateCharacterDomain,
    dispatchStatOperation: characterContext.dispatchStatOperation,
    dispatchAttributeOperation: characterContext.dispatchAttributeOperation,
    dispatchSavingThrowOperation: characterContext.dispatchSavingThrowOperation,
    dispatchSkillOperation: characterContext.dispatchSkillOperation,
    dispatchConditionOperation: characterContext.dispatchConditionOperation,
    dispatchGameOperation: characterContext.dispatchGameOperation,
    deleteCharacter: characterContext.deleteCharacter,
    importCharacter: characterContext.importCharacter,
    completeLongRest: characterContext.completeLongRest,
    partyInventory: characterContext.partyInventory,
    stowHandOccupant: characterContext.stowHandOccupant,
    moveEquippedItem: (characterId, reference, destination) => {
      if (!sessionRuntime) {
        characterContext.moveEquippedItem(characterId, reference, destination)
        return
      }
      if (destination === "ground") {
        console.warn("[session-runtime] moving equipped items to ground is blocked until ground inventory is server-authoritative", { characterId, reference })
        return
      }
      sessionRuntime.dispatchEquipmentOperation({
        type: "character.equipment.move",
        characterId,
        reference,
        destination,
      })
    },
    dropHandOccupant: characterContext.dropHandOccupant,
    moveEquippedItemToGround: (characterId, reference) => {
      if (!sessionRuntime) {
        characterContext.moveEquippedItem(characterId, reference, "ground")
        return
      }
      console.warn("[session-runtime] moving equipped items to ground is blocked until ground inventory is server-authoritative", { characterId, reference })
    },
    addGroundItem: characterContext.addGroundItem,
    canUseGroundInventory: true,
    transferCharacters: characterContext.transferCharacters,
    transferItem: characterContext.transferItem,
    canTransferFromCharacter: characterContext.canTransferFromCharacter,
    canViewCharacterDetails: characterContext.canViewCharacterDetails,
    canAssignOwners: characterContext.canAssignOwners,
    canEditCharacterType: characterContext.canEditCharacterType,
    owners,
    currentOwner,
    knownPlayerKeys: characterContext.knownPlayerKeys,
    getOwner: characterContext.getOwner,
    createOwner: characterContext.createOwner,
  }

  return <CharacterWorkspaceProvider value={value}>{children}</CharacterWorkspaceProvider>
}

function deriveEquipmentOperations(current: CharacterTemplate, next: CharacterTemplate): SessionEquipmentOperation[] {
  const characterId = current.get("id")
  const beforeItems = collectEditableEquipmentItems(current)
  const afterItems = collectEditableEquipmentItems(next)

  if (beforeItems.size !== afterItems.size) return []

  const operations: SessionEquipmentOperation[] = []
  for (const [key, before] of beforeItems) {
    const after = afterItems.get(key)
    if (!after) return []
    if (JSON.stringify(before.item) === JSON.stringify(after.item)) continue
    if (before.item.id !== after.item.id) return []
    operations.push({
      type: "character.equipment.item.update",
      characterId,
      reference: before.reference,
      item: after.item as unknown as Record<string, unknown>,
    })
  }
  return operations
}

function collectEditableEquipmentItems(character: CharacterTemplate): Map<string, { reference: EquippedItemReference; item: Itemmable }> {
  const equipment = character.get("equipment")
  const entries = new Map<string, { reference: EquippedItemReference; item: Itemmable }>()

  const add = (key: string, reference: EquippedItemReference, item: Itemmable | undefined) => {
    if (item) entries.set(key, { reference, item })
  }

  add("shield", { type: "shield" }, equipment.shield)
  for (const slot of ["armor", "helmet", "gloves", "boots", "cape"] as const) {
    add(`slot:${slot}`, { type: "slot", slot }, equipment[slot])
  }
  for (const item of equipment.weapons) add(`weapon:${item.id}`, { type: "weapon", itemId: item.id }, item)
  for (const item of equipment.heldItems ?? []) add(`held:${item.id}`, { type: "held-item", itemId: item.id }, item)
  for (const item of equipment.rings) add(`ring:${item.id}`, { type: "ring", itemId: item.id }, item)
  for (const item of equipment.necklaces ?? []) add(`necklace:${item.id}`, { type: "necklace", itemId: item.id }, item)

  return entries
}

function deriveMagicOperations(current: CharacterTemplate, next: CharacterTemplate): SessionMagicOperation[] {
  const characterId = current.get("id")
  const before = current.getOrCreateMagic()
  const after = next.getOrCreateMagic()
  const operations: SessionMagicOperation[] = []

  const beforeKnown = new Map(before.spells.knownSpells.map((entry) => [entry.spells.id, entry]))
  const afterKnown = new Map(after.spells.knownSpells.map((entry) => [entry.spells.id, entry]))

  for (const [spellIndex, entry] of afterKnown) {
    const previous = beforeKnown.get(spellIndex)
    if (!previous) {
      operations.push({ type: "character.spell.add", characterId, spellEntry: entry as unknown as Record<string, unknown> })
      continue
    }
    if (previous.spells.prepared !== entry.spells.prepared) {
      operations.push({ type: "character.spell.prepare", characterId, spellIndex, prepared: entry.spells.prepared })
    }
  }
  for (const spellIndex of beforeKnown.keys()) {
    if (!afterKnown.has(spellIndex)) operations.push({ type: "character.spell.remove", characterId, spellIndex })
  }

  const beforeDescriptions = before.spells.castingDescriptions ?? {}
  const afterDescriptions = after.spells.castingDescriptions ?? {}
  const descriptionSpellIds = new Set([...Object.keys(beforeDescriptions), ...Object.keys(afterDescriptions)])
  for (const spellIndex of descriptionSpellIds) {
    const oldList = beforeDescriptions[spellIndex] ?? []
    const newList = afterDescriptions[spellIndex] ?? []
    if (oldList.length + 1 === newList.length && oldList.every((value, index) => value === newList[index])) {
      operations.push({ type: "character.spell.castingDescription.add", characterId, spellIndex })
      continue
    }
    if (oldList.length - 1 === newList.length) {
      const removedIndex = oldList.findIndex((value, index) => newList[index] !== value)
      operations.push({ type: "character.spell.castingDescription.remove", characterId, spellIndex, descriptionIndex: removedIndex < 0 ? oldList.length - 1 : removedIndex })
      continue
    }
    if (oldList.length === newList.length) {
      for (let index = 0; index < newList.length; index += 1) {
        if (oldList[index] !== newList[index]) operations.push({
          type: "character.spell.castingDescription.update",
          characterId,
          spellIndex,
          descriptionIndex: index,
          description: newList[index] ?? "",
        })
      }
    }
  }

  return operations
}
