import { useCallback, useEffect, useMemo, type ReactNode } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { EquippedItemReference } from "../../../models/characters/characterEquippedItemMovement"
import type { HandOccupantReference } from "../../../models/characters/characterHands"
import type { Itemmable } from "../../../models/items/item"
import { applySessionAbilityState } from "../../session-runtime/applySessionAbilityState"
import type { SessionCustomSystemOperation } from "../../session-runtime/customSystemSessionProtocol"
import type { SessionEquipmentOperation } from "../../session-runtime/equipmentSessionProtocol"
import type { SessionMagicOperation } from "../../session-runtime/magicSessionProtocol"
import type { SessionProficiencyOperation } from "../../session-runtime/proficiencySessionProtocol"
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

  useEffect(() => {
    if (!sessionRuntime || sessionRuntime.status !== "connected" || sessionRuntime.role !== "MASTER") return
    sessionRuntime.initializeInventory(characterContext.partyInventory, characterContext.groundInventory)
  }, [characterContext.groundInventory, characterContext.partyInventory, sessionRuntime?.initializeInventory, sessionRuntime?.role, sessionRuntime?.status])

  const projectedCharacters = useMemo(
    () => characterContext.visibleCharacters
      .filter((character) => sessionRuntime?.sessionCharactersById[character.get("id")]?.active !== false)
      .map((character) =>
        applySessionAbilityState(character, sessionRuntime?.abilitiesByCharacterId[character.get("id")]),
      ),
    [characterContext.visibleCharacters, sessionRuntime?.abilitiesByCharacterId, sessionRuntime?.sessionCharactersById],
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

    const ownerChanged = JSON.stringify(current.get("owner")) !== JSON.stringify(next.get("owner"))
    const magicChanged = JSON.stringify(current.get("magic")) !== JSON.stringify(next.get("magic"))
    const equipmentChanged = JSON.stringify(current.get("equipment")) !== JSON.stringify(next.get("equipment"))
    const inventoryChanged = JSON.stringify(current.get("inventory")) !== JSON.stringify(next.get("inventory"))
    const proficienciesChanged = JSON.stringify(current.get("sheet").proficiencies ?? []) !== JSON.stringify(next.get("sheet").proficiencies ?? [])
    const customSystemsChanged = JSON.stringify(current.get("sheet").customSystems ?? []) !== JSON.stringify(next.get("sheet").customSystems ?? [])

    if (ownerChanged) {
      const ownerOnly = current.withPatch({ owner: next.get("owner") })
      if (JSON.stringify(ownerOnly.toJSON()) !== JSON.stringify(next.toJSON())) {
        console.warn("[session-runtime] blocked a composite mutation that included owner lifecycle state", { characterId })
        return
      }
      sessionRuntime.dispatchCharacterLifecycleOperation({
        type: "character.session.owner.set",
        characterId,
        owner: next.get("owner"),
      })
      return
    }

    if (equipmentChanged || inventoryChanged) {
      const equipmentOperations = deriveEquipmentOperations(current, next)
      if (equipmentOperations.length) {
        for (const operation of equipmentOperations) sessionRuntime.dispatchEquipmentOperation(operation)
        return
      }
      console.warn("[session-runtime] blocked an unrecognized local inventory/equipment mutation", { characterId })
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

    if (proficienciesChanged) {
      const operations = deriveProficiencyOperations(current, next)
      if (!operations.length) {
        console.warn("[session-runtime] blocked an unrecognized local proficiency mutation", { characterId })
        return
      }
      for (const operation of operations) sessionRuntime.dispatchProficiencyOperation(operation)
      return
    }

    if (customSystemsChanged) {
      const operations = deriveCustomSystemOperations(current, next)
      if (!operations.length) {
        console.warn("[session-runtime] blocked an unrecognized local custom-system mutation", { characterId })
        return
      }
      for (const operation of operations) sessionRuntime.dispatchAbilityOperation(operation)
      return
    }

    if (JSON.stringify(current.toJSON()) !== JSON.stringify(next.toJSON())) {
      console.warn("[session-runtime] blocked an unrecognized generic character mutation; use a semantic session operation or explicit MASTER resync", { characterId })
    }
  }, [characterContext, projectedCharacters, sessionRuntime])

  const deleteCharacter = useCallback((characterId: string) => {
    if (!sessionRuntime) {
      characterContext.deleteCharacter(characterId)
      return
    }
    sessionRuntime.dispatchCharacterLifecycleOperation({ type: "character.session.remove", characterId })
  }, [characterContext, sessionRuntime])

  const stowHandOccupant = useCallback((characterId: string, reference: HandOccupantReference) => {
    if (!sessionRuntime) {
      characterContext.stowHandOccupant(characterId, reference)
      return
    }
    const character = projectedCharacters.find((entry) => entry.get("id") === characterId)
    if (!character) return
    const equippedReference = resolveHandReference(character, reference)
    if (!equippedReference) return
    sessionRuntime.dispatchEquipmentOperation({
      type: "character.equipment.move",
      characterId,
      reference: equippedReference,
      destination: "inventory",
    })
  }, [characterContext, projectedCharacters, sessionRuntime])

  const moveHandToGround = useCallback((characterId: string, reference: HandOccupantReference) => {
    if (!sessionRuntime) {
      characterContext.dropHandOccupant?.(characterId, reference)
      return
    }
    const character = projectedCharacters.find((entry) => entry.get("id") === characterId)
    if (!character) return
    const equippedReference = resolveHandReference(character, reference)
    if (!equippedReference) return
    sessionRuntime.dispatchInventoryOperation({ type: "character.equipment.move.ground", characterId, reference: equippedReference })
  }, [characterContext, projectedCharacters, sessionRuntime])

  const owners = characterContext.knownPlayerKeys.map((key) => characterContext.getOwner(key))
  const normalizedUserKey = userKey.trim()
  const currentOwner = normalizedUserKey ? characterContext.getOwner(normalizedUserKey) : undefined
  const sharedInventory = sessionRuntime?.inventoryState?.initialized ? sessionRuntime.inventoryState : null

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
    deleteCharacter,
    importCharacter: characterContext.importCharacter,
    completeLongRest: characterContext.completeLongRest,
    partyInventory: sharedInventory?.partyInventory ?? characterContext.partyInventory,
    stowHandOccupant,
    moveEquippedItem: (characterId, reference, destination) => {
      if (!sessionRuntime) {
        characterContext.moveEquippedItem(characterId, reference, destination)
        return
      }
      sessionRuntime.dispatchEquipmentOperation({ type: "character.equipment.move", characterId, reference, destination })
    },
    dropHandOccupant: moveHandToGround,
    moveEquippedItemToGround: (characterId, reference) => {
      if (!sessionRuntime) {
        characterContext.moveEquippedItem(characterId, reference, "ground")
        return
      }
      sessionRuntime.dispatchInventoryOperation({ type: "character.equipment.move.ground", characterId, reference })
    },
    addGroundItem: sessionRuntime ? undefined : characterContext.addGroundItem,
    canUseGroundInventory: Boolean(sharedInventory),
    transferCharacters: projectedCharacters,
    transferItem: (request) => {
      if (!sessionRuntime) {
        characterContext.transferItem?.(request)
        return
      }
      const characterId = request.from.type === "character"
        ? request.from.characterId
        : request.to.type === "character"
          ? request.to.characterId
          : "session"
      sessionRuntime.dispatchInventoryOperation({ type: "inventory.item.transfer", characterId, request })
    },
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

function resolveHandReference(character: CharacterTemplate, reference: HandOccupantReference): EquippedItemReference | null {
  const equipment = character.get("equipment")
  if (reference.type === "shield") return equipment.shield ? { type: "shield" } : null
  if (reference.type === "weapon") {
    const item = equipment.weapons[reference.index]
    return item ? { type: "weapon", itemId: item.id } : null
  }
  const item = (equipment.heldItems ?? [])[reference.index]
  return item ? { type: "held-item", itemId: item.id } : null
}

function deriveCustomSystemOperations(current: CharacterTemplate, next: CharacterTemplate): SessionCustomSystemOperation[] {
  const activation = deriveCustomAbilityActivation(current, next)
  if (activation) return [activation]

  const characterId = current.get("id")
  const beforeStates = current.get("sheet").customSystems ?? []
  const afterStates = next.get("sheet").customSystems ?? []
  if (beforeStates.length !== afterStates.length) return []

  const afterById = new Map(afterStates.map((state) => [state.systemId, state]))
  const changed = beforeStates.flatMap((before) => {
    const after = afterById.get(before.systemId)
    return after && JSON.stringify(before) !== JSON.stringify(after) ? [{ before, after }] : []
  })
  if (changed.length !== 1) return []

  const { before, after } = changed[0]
  if (before.systemVersion !== after.systemVersion || before.enabled !== after.enabled) return []

  const fieldsEqual = JSON.stringify(before.fields) === JSON.stringify(after.fields)
  const resourcesEqual = JSON.stringify(before.resources) === JSON.stringify(after.resources)
  const abilitiesEqual = JSON.stringify(before.abilities) === JSON.stringify(after.abilities)

  if (!fieldsEqual && resourcesEqual && abilitiesEqual) {
    const fieldIds = new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])
    const changedFields = [...fieldIds].filter((fieldId) => JSON.stringify(before.fields[fieldId]) !== JSON.stringify(after.fields[fieldId]))
    if (changedFields.length !== 1) return []
    const fieldId = changedFields[0]
    const value = after.fields[fieldId]
    return value === undefined
      ? [{ type: "character.customSystem.field.remove", characterId, systemId: before.systemId, fieldId }]
      : [{ type: "character.customSystem.field.set", characterId, systemId: before.systemId, fieldId, value }]
  }

  if (fieldsEqual && !resourcesEqual && abilitiesEqual) {
    const resourceIds = new Set([...Object.keys(before.resources), ...Object.keys(after.resources)])
    const changedResources = [...resourceIds].filter((resourceId) => JSON.stringify(before.resources[resourceId]) !== JSON.stringify(after.resources[resourceId]))
    if (changedResources.length !== 1) return []
    const resourceId = changedResources[0]
    const beforeResource = before.resources[resourceId]
    const afterResource = after.resources[resourceId]
    if (!beforeResource || !afterResource) return []

    if (
      beforeResource.maximum === afterResource.maximum
      && beforeResource.temporary === afterResource.temporary
      && beforeResource.current !== afterResource.current
    ) {
      const amount = afterResource.current - beforeResource.current
      if (Number.isFinite(amount) && amount !== 0) {
        return [{ type: "character.customSystem.resource.adjust", characterId, systemId: before.systemId, resourceId, amount }]
      }
    }

    return [{
      type: "character.customSystem.resource.set",
      characterId,
      systemId: before.systemId,
      resourceId,
      state: afterResource,
    }]
  }

  if (fieldsEqual && resourcesEqual && !abilitiesEqual) {
    return deriveSingleAbilityOperation(characterId, before.systemId, before.abilities, after.abilities)
  }

  return []
}

function deriveSingleAbilityOperation(
  characterId: string,
  systemId: string,
  beforeAbilities: NonNullable<ReturnType<CharacterTemplate["get"]>["customSystems"]>[number]["abilities"],
  afterAbilities: NonNullable<ReturnType<CharacterTemplate["get"]>["customSystems"]>[number]["abilities"],
): SessionCustomSystemOperation[] {
  const beforeById = new Map(beforeAbilities.map((ability) => [ability.id, ability]))
  const afterById = new Map(afterAbilities.map((ability) => [ability.id, ability]))

  const added = afterAbilities.filter((ability) => !beforeById.has(ability.id))
  const removed = beforeAbilities.filter((ability) => !afterById.has(ability.id))
  if (added.length === 1 && removed.length === 0 && beforeAbilities.length + 1 === afterAbilities.length) {
    return [{ type: "character.customSystem.ability.add", characterId, systemId, ability: added[0] }]
  }
  if (removed.length === 1 && added.length === 0 && beforeAbilities.length - 1 === afterAbilities.length) {
    return [{ type: "character.customSystem.ability.remove", characterId, systemId, abilityId: removed[0].id }]
  }
  if (added.length || removed.length || beforeAbilities.length !== afterAbilities.length) return []

  const changed = beforeAbilities.flatMap((before) => {
    const after = afterById.get(before.id)
    return after && JSON.stringify(before) !== JSON.stringify(after) ? [{ before, after }] : []
  })
  if (changed.length !== 1) return []
  const { before, after } = changed[0]

  const baseBefore = { ...before, values: undefined, learned: undefined, prepared: undefined, usage: undefined }
  const baseAfter = { ...after, values: undefined, learned: undefined, prepared: undefined, usage: undefined }
  if (JSON.stringify(baseBefore) !== JSON.stringify(baseAfter)) return []

  if (JSON.stringify(before.values) !== JSON.stringify(after.values)) {
    if (before.learned !== after.learned || before.prepared !== after.prepared || JSON.stringify(before.usage) !== JSON.stringify(after.usage)) return []
    const fieldIds = new Set([...Object.keys(before.values), ...Object.keys(after.values)])
    const changedFields = [...fieldIds].filter((fieldId) => JSON.stringify(before.values[fieldId]) !== JSON.stringify(after.values[fieldId]))
    if (changedFields.length !== 1) return []
    const fieldId = changedFields[0]
    const value = after.values[fieldId]
    if (value === undefined) return []
    return [{ type: "character.customSystem.ability.field.set", characterId, systemId, abilityId: before.id, fieldId, value }]
  }

  if (before.learned !== after.learned && before.prepared === after.prepared && JSON.stringify(before.usage) === JSON.stringify(after.usage)) {
    return [{ type: "character.customSystem.ability.learned.set", characterId, systemId, abilityId: before.id, learned: after.learned !== false }]
  }
  if (before.prepared !== after.prepared && before.learned === after.learned && JSON.stringify(before.usage) === JSON.stringify(after.usage)) {
    return [{ type: "character.customSystem.ability.prepared.set", characterId, systemId, abilityId: before.id, prepared: after.prepared === true }]
  }
  if (JSON.stringify(before.usage) !== JSON.stringify(after.usage) && before.learned === after.learned && before.prepared === after.prepared) {
    if (!after.usage || !Number.isInteger(after.usage.used) || after.usage.used < 0) return []
    if (before.usage?.maximum !== after.usage.maximum) return []
    return [{ type: "character.customSystem.ability.usage.set", characterId, systemId, abilityId: before.id, used: after.usage.used }]
  }

  return []
}

function deriveCustomAbilityActivation(
  current: CharacterTemplate,
  next: CharacterTemplate,
): Extract<SessionCustomSystemOperation, { type: "character.customSystem.ability.activate" }> | null {
  const beforeStates = current.get("sheet").customSystems ?? []
  const afterStates = next.get("sheet").customSystems ?? []
  const afterBySystem = new Map(afterStates.map((state) => [state.systemId, state]))
  const candidates: Array<{ systemId: string; abilityId: string }> = []

  for (const beforeState of beforeStates) {
    const afterState = afterBySystem.get(beforeState.systemId)
    if (!afterState) continue
    const afterAbilities = new Map(afterState.abilities.map((ability) => [ability.id, ability]))
    for (const beforeAbility of beforeState.abilities) {
      const afterAbility = afterAbilities.get(beforeAbility.id)
      if (!afterAbility) continue
      const beforeUsed = beforeAbility.usage?.used
      const afterUsed = afterAbility.usage?.used
      if (beforeUsed !== undefined && afterUsed === beforeUsed + 1) {
        const withoutUsageBefore = { ...beforeAbility, usage: beforeAbility.usage ? { ...beforeAbility.usage, used: afterUsed } : undefined }
        if (JSON.stringify(withoutUsageBefore) === JSON.stringify(afterAbility)) {
          candidates.push({ systemId: beforeState.systemId, abilityId: beforeAbility.id })
        }
      }
    }
  }

  if (candidates.length !== 1 || !hasActivationSideEffects(current, next)) return null
  return {
    type: "character.customSystem.ability.activate",
    characterId: current.get("id"),
    systemId: candidates[0].systemId,
    abilityId: candidates[0].abilityId,
  }
}

function hasActivationSideEffects(current: CharacterTemplate, next: CharacterTemplate): boolean {
  const beforeStates = current.get("sheet").customSystems ?? []
  const afterStates = next.get("sheet").customSystems ?? []
  const beforeResources = beforeStates.map((state) => [state.systemId, state.resources])
  const afterResources = afterStates.map((state) => [state.systemId, state.resources])
  if (JSON.stringify(beforeResources) !== JSON.stringify(afterResources)) return true

  const { customSystems: _beforeCustomSystems, ...beforeSheet } = current.get("sheet")
  const { customSystems: _afterCustomSystems, ...afterSheet } = next.get("sheet")
  return JSON.stringify(beforeSheet) !== JSON.stringify(afterSheet)
}

function deriveProficiencyOperations(current: CharacterTemplate, next: CharacterTemplate): SessionProficiencyOperation[] {
  const characterId = current.get("id")
  const before = new Map((current.get("sheet").proficiencies ?? []).map((entry) => [entry.id, entry]))
  const after = new Map((next.get("sheet").proficiencies ?? []).map((entry) => [entry.id, entry]))
  const operations: SessionProficiencyOperation[] = []

  for (const [id, proficiency] of after) {
    const previous = before.get(id)
    if (!previous) {
      operations.push({ type: "character.proficiency.add", characterId, proficiency })
      continue
    }
    if (JSON.stringify(previous) !== JSON.stringify(proficiency)) return []
  }
  for (const [id, proficiency] of before) {
    if (!after.has(id)) operations.push({ type: "character.proficiency.remove", characterId, proficiencyId: id, proficiencyName: proficiency.name })
  }
  return operations
}

function deriveEquipmentOperations(current: CharacterTemplate, next: CharacterTemplate): SessionEquipmentOperation[] {
  const characterId = current.get("id")
  const attunementOperation = deriveAttunementOperation(current, next)
  if (attunementOperation) return [attunementOperation]

  const beforeEquipment = current.get("equipment")
  const afterEquipment = next.get("equipment")
  const beforePockets = beforeEquipment.pockets
  const afterPockets = afterEquipment.pockets

  if (beforePockets.length === afterPockets.length + 1) {
    const removedIndex = beforePockets.findIndex((item, index) => afterPockets[index]?.id !== item.id)
    const index = removedIndex < 0 ? beforePockets.length - 1 : removedIndex
    const removed = beforePockets[index]
    if (removed) {
      if (afterEquipment.weapons.some((weapon) => weapon.id === removed.id)) {
        return [{ type: "character.equipment.pocket.wield", characterId, index }]
      }
      const changedInventory = JSON.stringify(current.get("inventory")) !== JSON.stringify(next.get("inventory"))
      if (changedInventory) return [{ type: "character.equipment.pocket.unequip", characterId, index }]
      if (removed.kind === "consumable" || removed.kind === "throwable" || removed.kind === "ammunition") {
        return [{ type: "character.equipment.pocket.use", characterId, index }]
      }
    }
  }

  if (beforePockets.length === afterPockets.length) {
    for (let index = 0; index < beforePockets.length; index += 1) {
      const before = beforePockets[index]
      const after = afterPockets[index]
      if (!before || !after || before.id !== after.id) continue
      if (Number(after.quantity ?? 1) < Number(before.quantity ?? 1) && (before.kind === "consumable" || before.kind === "throwable" || before.kind === "ammunition")) {
        return [{ type: "character.equipment.pocket.use", characterId, index }]
      }
    }
  }

  const beforeItems = collectEditableEquipmentItems(current)
  const afterItems = collectEditableEquipmentItems(next)
  if (beforeItems.size !== afterItems.size) return []
  const operations: SessionEquipmentOperation[] = []
  for (const [key, before] of beforeItems) {
    const after = afterItems.get(key)
    if (!after) return []
    if (JSON.stringify(before.item) === JSON.stringify(after.item)) continue
    if (before.item.id !== after.item.id) return []
    operations.push({ type: "character.equipment.item.update", characterId, reference: before.reference, item: after.item as unknown as Record<string, unknown> })
  }
  return operations
}

function deriveAttunementOperation(current: CharacterTemplate, next: CharacterTemplate): SessionEquipmentOperation | null {
  const before = collectCarriedItems(current)
  const after = collectCarriedItems(next)
  if (before.size !== after.size) return null
  let changedItemId: string | null = null
  for (const [itemId, beforeItem] of before) {
    const afterItem = after.get(itemId)
    if (!afterItem) return null
    if (beforeItem.attuned === afterItem.attuned) continue
    if (changedItemId) return null
    changedItemId = itemId
  }
  if (!changedItemId) return null
  const stripAttuned = (item: Itemmable) => { const { attuned: _attuned, ...rest } = item; return rest }
  const beforeItem = before.get(changedItemId)
  const afterItem = after.get(changedItemId)
  if (!beforeItem || !afterItem || JSON.stringify(stripAttuned(beforeItem)) !== JSON.stringify(stripAttuned(afterItem))) return null
  return { type: "character.equipment.attunement.toggle", characterId: current.get("id"), itemId: changedItemId }
}

function collectCarriedItems(character: CharacterTemplate): Map<string, Itemmable> {
  const equipment = character.get("equipment")
  const items: Itemmable[] = [
    ...character.get("inventory"), equipment.armor, equipment.boots, equipment.helmet,
    equipment.gloves, equipment.cape, equipment.shield, ...equipment.rings,
    ...equipment.weapons, ...equipment.pockets, ...(equipment.necklaces ?? []),
    ...(equipment.heldItems ?? []),
  ].filter((item): item is Itemmable => Boolean(item))
  return new Map(items.map((item) => [item.id, item]))
}

function collectEditableEquipmentItems(character: CharacterTemplate): Map<string, { reference: EquippedItemReference; item: Itemmable }> {
  const equipment = character.get("equipment")
  const entries = new Map<string, { reference: EquippedItemReference; item: Itemmable }>()
  const add = (key: string, reference: EquippedItemReference, item: Itemmable | undefined) => { if (item) entries.set(key, { reference, item }) }
  add("shield", { type: "shield" }, equipment.shield)
  for (const slot of ["armor", "helmet", "gloves", "boots", "cape"] as const) add(`slot:${slot}`, { type: "slot", slot }, equipment[slot])
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
    if (!previous) { operations.push({ type: "character.spell.add", characterId, spellEntry: entry as unknown as Record<string, unknown> }); continue }
    if (previous.spells.prepared !== entry.spells.prepared) operations.push({ type: "character.spell.prepare", characterId, spellIndex, prepared: entry.spells.prepared })
  }
  for (const spellIndex of beforeKnown.keys()) if (!afterKnown.has(spellIndex)) operations.push({ type: "character.spell.remove", characterId, spellIndex })
  const beforeDescriptions = before.spells.castingDescriptions ?? {}
  const afterDescriptions = after.spells.castingDescriptions ?? {}
  for (const spellIndex of new Set([...Object.keys(beforeDescriptions), ...Object.keys(afterDescriptions)])) {
    const oldList = beforeDescriptions[spellIndex] ?? []
    const newList = afterDescriptions[spellIndex] ?? []
    if (oldList.length + 1 === newList.length && oldList.every((value, index) => value === newList[index])) { operations.push({ type: "character.spell.castingDescription.add", characterId, spellIndex }); continue }
    if (oldList.length - 1 === newList.length) { const removedIndex = oldList.findIndex((value, index) => newList[index] !== value); operations.push({ type: "character.spell.castingDescription.remove", characterId, spellIndex, descriptionIndex: removedIndex < 0 ? oldList.length - 1 : removedIndex }); continue }
    if (oldList.length === newList.length) for (let index = 0; index < newList.length; index += 1) if (oldList[index] !== newList[index]) operations.push({ type: "character.spell.castingDescription.update", characterId, spellIndex, descriptionIndex: index, description: newList[index] ?? "" })
  }
  return operations
}
