import type { AppStateV1 } from "../../lib/remoteState"
import { normalizeItemText } from "../../lib/textNormalization"
import { CharacterTemplate } from "../characters/CharacterTemplate"
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
  MAX_GAME_OPERATION_LOG,
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
    operations: [...(applied.operations ?? []), record].slice(
      -MAX_GAME_OPERATION_LOG,
    ),
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
        characters: state.characters.map((rawCharacter) => {
          const character = CharacterTemplate.fromJSON(rawCharacter)
          return character.get("id") === operation.characterId
            ? touchCharacterProps(operation.character, meta)
            : character.toJSON()
        }),
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
    const character = CharacterTemplate.fromJSON(rawCharacter)

    if (character.get("id") !== characterId) {
      return character.toJSON()
    }

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
  const characterObjects = state.characters.map((rawCharacter) =>
    CharacterTemplate.fromJSON(rawCharacter),
  )
  const restedCharacter = characterObjects.find(
    (character) => character.get("id") === characterId,
  )

  if (!restedCharacter) return state

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
    characters: characterObjects.map((character) => {
      if (character.get("id") !== characterId) {
        return character.toJSON()
      }

      return touchCharacter(
        isPartialRest
          ? takePartialLongRest(character)
          : takeLongRest(character),
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

  const characterObjects = state.characters.map((raw) =>
    CharacterTemplate.fromJSON(raw),
  )
  const partyInventory = [...(state.partyInventory ?? [])]
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

  destinationInventory.push(
    touchItem(
      normalizeItemText({
        ...sourceItem,
        id: request.destinationItemId ?? crypto.randomUUID(),
        quantity: movedQuantity,
        insideBagOfHolding: false,
      }),
      meta,
    ),
  )

  return {
    ...state,
    partyInventory,
    characters: characterObjects.map((character) =>
      touchCharacter(
        character.with(
          "inventory",
          inventoryByCharacterId.get(character.get("id")) ?? [],
        ),
        meta,
      ).toJSON(),
    ),
  }
}

function touchCharacter(
  character: CharacterTemplate,
  meta?: ApplyMeta,
): CharacterTemplate {
  return character.withPatch(touchMetadata(character.toJSON(), meta))
}

function touchCharacterProps(
  character: CharacterTemplate["toJSON"] extends () => infer T ? T : never,
  meta?: ApplyMeta,
): CharacterTemplate["toJSON"] extends () => infer T ? T : never {
  return touchMetadata(character, meta)
}

function touchItem<TItem extends Itemmable>(
  item: TItem,
  meta?: ApplyMeta,
): TItem {
  return touchMetadata(item, meta)
}

function touchMetadata<TValue extends GameEntityMetadata>(
  value: TValue,
  meta?: ApplyMeta,
): TValue {
  if (!meta) return value

  return {
    ...value,
    version: Math.max(0, Math.trunc(Number(value.version) || 0)) + 1,
    updatedAt: meta.createdAt,
    updatedBy: meta.actorId,
  }
}

function locationKey(location: InventoryLocation): string {
  return location.type === "party"
    ? "party"
    : `character:${location.characterId}`
}

function getLocationInventory(
  location: InventoryLocation,
  partyInventory: Itemmable[],
  inventoryByCharacterId: Map<string, Itemmable[]>,
): Itemmable[] | undefined {
  if (location.type === "party") return partyInventory
  return inventoryByCharacterId.get(location.characterId)
}
