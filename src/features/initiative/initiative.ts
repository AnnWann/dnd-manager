import type { Character } from "../../types"

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

export type InitiativeResult = {
  character: Character
  rolledValue: number
  initiative: number
  effects: InitiativeEffect[]
}

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