import type { Character, InitiativeResult as InitiativeEntry } from "../models/types"

export type InitiativeEffect = {
  id: string
  label: string
  turnsRemaining: number
  // When true the first activation of the affected character after applying
  // the effect will NOT decrement the duration; the flag is cleared on that activation.
  defer?: boolean
}


export function calcCharacterInitiative(character: Character, rolledValue: number): number {
  const dexMod = Math.floor((character.attributes.dex - 10) / 2)
  return rolledValue + dexMod + (character.initiativeBonus || 0)
}

export type InitiativeResult = InitiativeEntry

export function decrementInitiativeEffect(effect: InitiativeEffect): InitiativeEffect | null {
  // If effect is newly applied and marked to defer, consume the defer flag
  // without decrementing the remaining turns.
  if (effect.defer) {
    return {
      ...effect,
      defer: false,
    }
  }

  const nextTurns = effect.turnsRemaining - 1
  if (nextTurns <= 0) return null
  return {
    ...effect,
    turnsRemaining: nextTurns,
  }
}

export type InitiativeState = {
  initiativeOrder: InitiativeResult[],
  currentTurnIndex: number
}

export function buildInitiativeInstance(
  sourceCharacter: Character,
  instanceCount: number,
  rolledValue: number,
): InitiativeResult {
  const instanceNumber = instanceCount + 1
  // For 'general' characters always append the instance number starting at 1
  // For 'unique' characters keep the name without number on the first instance
  const displayName =
    sourceCharacter.initiativeMode === 'general'
      ? `${sourceCharacter.name} ${instanceNumber}`
      : instanceNumber === 1
      ? sourceCharacter.name
      : `${sourceCharacter.name} ${instanceNumber}`
  return {
    id: crypto.randomUUID(),
    sourceCharacterId: sourceCharacter.id,
    displayName,
    currentHp: sourceCharacter.currentHp,
    maxHp: sourceCharacter.maxHp,
    temporaryHp: sourceCharacter.temporaryHp,
    armorClass: sourceCharacter.armorClass,
    rolledValue,
    ownerKey: sourceCharacter.ownerKey,
    visibilityRole: sourceCharacter.visibilityRole,
    initiative: calcCharacterInitiative(sourceCharacter, rolledValue),
    effects: [],
  }
}