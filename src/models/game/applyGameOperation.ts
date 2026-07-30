import type { AppStateV1 } from "../../lib/remoteState"
import { normalizeItemText } from "../../lib/textNormalization"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../characters/CharacterTemplate"
import {
  takeLongRest,
  takePartialLongRest,
} from "../characters/characterRestWithSorcery"
import type { Itemmable } from "../items/item"
import {
  consumeSelectedSupplies,
  getRequiredSupplyForRace,
} from "../supplies/partySupply"
import {
  compactGameOperationLog,
  type GameEntityMetadata,
  type GameOperation,
  type GameOperationRecord,
  type InventoryLocation,
  type TransferItemOperationRequest,
} from "./GameOperation"

type ApplyMeta = Pick<GameOperationRecord, "actorId" | "createdAt">

export function applyRecordedGameOperation<TState extends AppStateV1>(
  state: TState,
  record: GameOperationRecord,
): TState {
  const applied = applyGameOperation(state, record.operation, record)
  const currentVersion = Math.max(
    0,
    Math.trunc(Number(state.stateVersion) || 0),
  )

  return {
    ...applied,
    stateVersion: currentVersion + 1,
    updatedAt: record.createdAt,
    updatedBy: record.actorId,
    entityVersions: touchEntityVersions(
      applied.entityVersions ?? {},
      getTouchedEntityKeys(record.operation),
      record,
    ),
    operations: compactGameOperationLog([...(applied.operations ?? []), record]),
  }
}

export function applyGameOperation<TState extends AppStateV1>(
  state: TState,
  operation: GameOperation,
  meta?: ApplyMeta,
): TState {
  switch (operation.type) {
    case "character.add":
      return {
        ...state,
        characters: [
          ...state.characters,
          touchCharacterProps(operation.character, meta),
        ],
        activeCharacterId: operation.select
          ? operation.character.id
          : state.activeCharacterId,
      }

    case "character.replace":
      return {
        ...state,
        characters: state.characters.map((rawCharacter) =>
          rawCharacter.id === operation.characterId
            ? touchCharacterProps(operation.character, meta)
            : rawCharacter,
        ),
      }

    case "character.delete":
      return {
        ...state,
        characters: state.characters.filter(
          (rawCharacter) => rawCharacter.id !== operation.characterId,
        ),
        activeCharacterId:
          state.activeCharacterId === operation.characterId
            ? ""
            : state.activeCharacterId,
      }

    case "character.longRest.complete":
      return completeLongRest(state, operation.characterId, operation.selection, meta)

    case "character.hp.set":
      return updateCharacter(state, operation.characterId, (character) =>
        character.setCurrentHp(operation.value),
      meta)

    case "character.hp.temporary.set":
      return updateCharacter(state, operation.characterId, (character) =>
        character.setTemporaryHp(operation.value),
      meta)

    case "character.hp.damage":
      return updateCharacter(state, operation.characterId, (character) =>
        character.takeDamage(operation.amount),
      meta)

    case "character.hp.heal":
      return updateCharacter(state, operation.characterId, (character) =>
        character.heal(operation.amount),
      meta)

    case "character.ability.add":
      return updateCharacter(state, operation.characterId, (character) =>
        character.addAbility(operation.ability),
      meta)

    case "character.ability.save":
      return updateCharacter(state, operation.characterId, (character) =>
        character.saveAbility(operation.ability),
      meta)

    case "character.ability.remove":
      return updateCharacter(state, operation.characterId, (character) =>
        character.removeAbility(operation.abilityId),
      meta)

    case "character.ability.use":
      return updateCharacter(state, operation.characterId, (character) =>
        character.useAbility(operation.abilityId),
      meta)

    case "character.ability.restore":
      return updateCharacter(state, operation.characterId, (character) =>
        character.restoreAbility(operation.abilityId),
      meta)

    case "character.ability.reset":
      return updateCharacter(state, operation.characterId, (character) =>
        character.resetAbility(operation.abilityId),
      meta)

    case "character.spellSlot.spend":
      return updateCharacter(state, operation.characterId, (character) =>
        character.spendSpellSlot(operation.level),
      meta)

    case "character.spellSlot.restore":
      return updateCharacter(state, operation.characterId, (character) =>
        character.restoreSpellSlot(operation.level),
      meta)

    case "character.pactSlot.spend":
      return updateCharacter(state, operation.characterId, (character) =>
        character.spendPactSlot(),
      meta)

    case "character.pactSlot.restore":
      return updateCharacter(state, operation.characterId, (character) =>
        character.restorePactSlot(),
      meta)

    case "party.item.add":
      return {
        ...state,
        partyInventory: [
          ...(state.partyInventory ?? []),
          touchItem(normalizeItemText(operation.item), meta),
        ],
      }

    case "party.item.update":
      return {
        ...state,
        partyInventory: (state.partyInventory ?? []).map((item) =>
          item.id === operation.itemId
            ? touchItem(normalizeItemText(operation.item), meta)
            : item,
        ),
      }

    case "party.item.remove":
      return {
        ...state,
        partyInventory: (state.partyInventory ?? []).filter(
          (item) => item.id !== operation.itemId,
        ),
      }

    case "ground.item.add":
      return {
        ...state,
        groundInventory: [
          ...(state.groundInventory ?? []),
          touchItem(normalizeItemText(operation.item), meta),
        ],
      }

    case "ground.item.update":
      return {
        ...state,
        groundInventory: (state.groundInventory ?? []).map((item) =>
          item.id === operation.itemId
            ? touchItem(normalizeItemText(operation.item), meta)
            : item,
        ),
      }

    case "ground.item.remove":
      return {
        ...state,
        groundInventory: (state.groundInventory ?? []).filter(
          (item) => item.id !== operation.itemId,
        ),
      }

    case "inventory.item.transfer":
      return transferItem(state, operation.request, meta)
  }
}

function updateCharacter<TState extends AppStateV1>(
  state: TState,
  characterId: string,
  updater: (character: CharacterTemplate) => CharacterTemplate,
  meta?: ApplyMeta,
): TState {
  let changed = false

  const characters = state.characters.map((rawCharacter) => {
    if (rawCharacter.id !== characterId) return rawCharacter

    const character = CharacterTemplate.fromJSON(rawCharacter)
    changed = true
    return touchCharacter(updater(character), meta).toJSON()
  })

  if (!changed) return state

  return {
    ...state,
    characters,
  }
}

function completeLongRest<TState extends AppStateV1>(
  state: TState,
  characterId: string,
  selection: Parameters<typeof consumeSelectedSupplies>[1],
  meta?: ApplyMeta,
): TState {
  const restedRawCharacter = state.characters.find(
    (rawCharacter) => rawCharacter.id === characterId,
  )
  if (!restedRawCharacter) return state

  const restedCharacter = CharacterTemplate.fromJSON(restedRawCharacter)
  const requiredSupply = getRequiredSupplyForRace(
    restedCharacter.get("sheet").race,
  )
  const consumption = consumeSelectedSupplies(
    state.partyInventory ?? [],
    selection,
  )

  if (!consumption.valid) return state

  const isPartialRest =
    consumption.selectedPortions + 0.000001 < requiredSupply

  return {
    ...state,
    characters: state.characters.map((rawCharacter) => {
      if (rawCharacter.id !== characterId) return rawCharacter

      return touchCharacter(
        isPartialRest
          ? takePartialLongRest(restedCharacter)
          : takeLongRest(restedCharacter),
        meta,
      ).toJSON()
    }),
    partyInventory: consumption.items.map((item) => touchItem(item, meta)),
  }
}

function transferItem<TState extends AppStateV1>(
  state: TState,
  request: TransferItemOperationRequest,
  meta?: ApplyMeta,
): TState {
  if (locationKey(request.from) === locationKey(request.to)) return state

  const partyInventory = [...(state.partyInventory ?? [])]
  const groundInventory = [...(state.groundInventory ?? [])]
  const inventoryByCharacterId = new Map(
    state.characters.map((rawCharacter) => [
      rawCharacter.id,
      [...(rawCharacter.inventory ?? [])],
    ]),
  )

  const sourceInventory = getLocationInventory(
    request.from,
    partyInventory,
    groundInventory,
    inventoryByCharacterId,
  )
  const destinationInventory = getLocationInventory(
    request.to,
    partyInventory,
    groundInventory,
    inventoryByCharacterId,
  )

  if (!sourceInventory || !destinationInventory) return state

  const itemIndex = sourceInventory.findIndex(
    (item) => item.id === request.itemId,
  )
  if (itemIndex < 0) return state

  const sourceItem = sourceInventory[itemIndex]
  const availableQuantity = Math.max(
    0,
    Number(sourceItem.quantity) || 0,
  )
  if (availableQuantity <= 0) return state

  const requestedQuantity = Math.max(
    1,
    Math.trunc(Number(request.quantity) || availableQuantity),
  )
  const movedQuantity = Math.min(availableQuantity, requestedQuantity)

  if (movedQuantity >= availableQuantity) {
    sourceInventory.splice(itemIndex, 1)
  } else {
    sourceInventory[itemIndex] = touchItem(
      normalizeItemText({
        ...sourceItem,
        quantity: availableQuantity - movedQuantity,
      }),
      meta,
    )
  }

  const movedItem = normalizeItemText({
    ...sourceItem,
    id: request.destinationItemId ?? crypto.randomUUID(),
    quantity: movedQuantity,
    heldHands: undefined,
    wieldedTwoHanded: undefined,
    insideBagOfHolding: false,
  })

  addOrMergeStack(destinationInventory, movedItem, meta)

  return {
    ...state,
    partyInventory,
    groundInventory,
    characters: state.characters.map((rawCharacter) => ({
      ...rawCharacter,
      inventory:
        inventoryByCharacterId.get(rawCharacter.id) ?? rawCharacter.inventory ?? [],
    })),
  }
}

function addOrMergeStack(
  inventory: Itemmable[],
  movedItem: Itemmable,
  meta?: ApplyMeta,
) {
  const existingIndex = inventory.findIndex((item) =>
    areItemsStackCompatible(item, movedItem),
  )

  if (existingIndex < 0) {
    inventory.push(touchItem(movedItem, meta))
    return
  }

  const existing = inventory[existingIndex]
  inventory[existingIndex] = touchItem(
    normalizeItemText({
      ...existing,
      quantity:
        Math.max(0, Number(existing.quantity) || 0) +
        Math.max(0, Number(movedItem.quantity) || 0),
      insideBagOfHolding: false,
    }),
    meta,
  )
}

function areItemsStackCompatible(first: Itemmable, second: Itemmable): boolean {
  if (first.kind !== second.kind) return false
  if (first.name.trim().toLocaleLowerCase("pt-BR") !== second.name.trim().toLocaleLowerCase("pt-BR")) {
    return false
  }

  return stableStringify(stackComparableItem(first)) ===
    stableStringify(stackComparableItem(second))
}

function stackComparableItem(item: Itemmable): Record<string, unknown> {
  const {
    id: _id,
    quantity: _quantity,
    version: _version,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    insideBagOfHolding: _insideBagOfHolding,
    heldHands: _heldHands,
    wieldedTwoHanded: _wieldedTwoHanded,
    ...comparable
  } = item as Itemmable & GameEntityMetadata & {
    heldHands?: unknown
    wieldedTwoHanded?: unknown
  }

  return comparable
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

function touchCharacter(
  character: CharacterTemplate,
  meta?: ApplyMeta,
): CharacterTemplate {
  return character.withPatch(touchMetadata(character.toJSON(), meta))
}

function touchCharacterProps(
  character: CharacterTemplateProps,
  meta?: ApplyMeta,
): CharacterTemplateProps {
  return touchMetadata(character, meta)
}

function touchItem<TItem extends Itemmable>(
  item: TItem,
  meta?: ApplyMeta,
): TItem {
  return touchMetadata(item, meta)
}

function touchMetadata<TValue extends object>(
  value: TValue,
  meta?: ApplyMeta,
): TValue & GameEntityMetadata {
  if (!meta) return value as TValue & GameEntityMetadata

  const current = value as TValue & GameEntityMetadata

  return {
    ...current,
    version: Math.max(0, Math.trunc(Number(current.version) || 0)) + 1,
    updatedAt: meta.createdAt,
    updatedBy: meta.actorId,
  }
}

function touchEntityVersions(
  versions: Record<string, GameEntityMetadata>,
  entityKeys: string[],
  meta: ApplyMeta,
): Record<string, GameEntityMetadata> {
  const next = { ...versions }

  for (const key of entityKeys) {
    const previous = next[key] ?? {}
    next[key] = touchMetadata(previous, meta)
  }

  return next
}

function getTouchedEntityKeys(operation: GameOperation): string[] {
  switch (operation.type) {
    case "character.add":
      return [`character:${operation.character.id}`]
    case "character.replace":
    case "character.delete":
    case "character.longRest.complete":
    case "character.hp.set":
    case "character.hp.temporary.set":
    case "character.hp.damage":
    case "character.hp.heal":
    case "character.ability.add":
    case "character.ability.save":
    case "character.ability.remove":
    case "character.ability.use":
    case "character.ability.restore":
    case "character.ability.reset":
    case "character.spellSlot.spend":
    case "character.spellSlot.restore":
    case "character.pactSlot.spend":
    case "character.pactSlot.restore":
      return [`character:${operation.characterId}`]
    case "party.item.add":
      return ["inventory:party", `partyItem:${operation.item.id}`]
    case "party.item.update":
    case "party.item.remove":
      return ["inventory:party", `partyItem:${operation.itemId}`]
    case "ground.item.add":
      return ["inventory:ground", `groundItem:${operation.item.id}`]
    case "ground.item.update":
    case "ground.item.remove":
      return ["inventory:ground", `groundItem:${operation.itemId}`]
    case "inventory.item.transfer":
      return [
        `inventory:${locationKey(operation.request.from)}`,
        `inventory:${locationKey(operation.request.to)}`,
        `item:${operation.request.itemId}`,
        ...(operation.request.destinationItemId
          ? [`item:${operation.request.destinationItemId}`]
          : []),
      ]
  }
}

function locationKey(location: InventoryLocation): string {
  if (location.type === "party") return "party"
  if (location.type === "ground") return "ground"
  return `character:${location.characterId}`
}

function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  groundInventory: Itemmable[],
  inventoryByCharacterId: Map<string, Itemmable[]>,
): Itemmable[] | undefined {
  if (location.type === "party") return partyInventory
  if (location.type === "ground") return groundInventory
  return inventoryByCharacterId.get(location.characterId)
}
