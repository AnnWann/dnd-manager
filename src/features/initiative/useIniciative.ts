import { useState } from "react"
import type { Character } from "../../types"
import { calcCharacterInitiative, type InitiativeResult } from "./initiative"

export function useInitiative() {
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeResult[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)

  function addToInitiative(character: Character, rolledValue: number) {
    const initiative = calcCharacterInitiative(character, rolledValue)

    setInitiativeOrder((prev) =>
      [...prev, { character, rolledValue, initiative }]
        .sort((a, b) => b.initiative - a.initiative),
    )
  }

  function removeFromInitiative(characterId: string) {
    setInitiativeOrder((prev) => {
      const next = prev.filter((entry) => entry.character.id !== characterId)

      setCurrentTurnIndex((index) =>
        next.length === 0 ? 0 : Math.min(index, next.length - 1),
      )

      return next
    })
  }

  function clearInitiative() {
    setInitiativeOrder([])
    setCurrentTurnIndex(0)
  }

  function nextTurn() {
    setCurrentTurnIndex((prev) => {
      if (initiativeOrder.length === 0) return 0
      return (prev + 1) % initiativeOrder.length
    })
  }

  const currentTurn = initiativeOrder[currentTurnIndex] ?? null

  return {
    initiativeOrder,
    currentTurnIndex,
    currentTurn,
    addToInitiative,
    removeFromInitiative,
    clearInitiative,
    nextTurn,
  }
}