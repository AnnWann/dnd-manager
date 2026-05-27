import type { Character } from "../../types"


export function calcCharacterInitiative(character: Character, rolledValue: number): number {
  const dexMod = Math.floor((character.attributes.dex - 10) / 2)
  return rolledValue + dexMod + (character.initiativeBonus || 0)
}

export type InitiativeResult = {
  character: Character
  rolledValue: number
  initiative: number
}

export type InitiativeState = {
  initiativeOrder: InitiativeResult[],
  currentTurnIndex: number
}