import { useState } from "react"
import type { Character } from "../../types"
import { calcCharacterInitiative, type InitiativeEffect, type InitiativeResult } from "./initiative"

export function useInitiative() {
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeResult[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)

  function addToInitiative(character: Character, rolledValue: number) {
    const initiative = calcCharacterInitiative(character, rolledValue)

    setInitiativeOrder((prev) =>
      [...prev, { character, rolledValue, initiative, effects: [] }].sort(
        (a, b) => b.initiative - a.initiative,
      ),
    )
  }

  function applyEffect(characterId: string, effectLabel: string) {
    const label = effectLabel.trim()
    if (!label) return

    setInitiativeOrder((prev) =>
      prev.map((entry) => {
        if (entry.character.id !== characterId) return entry

        const exists = entry.effects.some(
          (effect) => effect.label.toLowerCase() === label.toLowerCase(),
        )
        if (exists) return entry

        const nextEffect: InitiativeEffect = {
          id: crypto.randomUUID(),
          label,
          turnsRemaining: 1,
          defer: true,
        }

        return {
          ...entry,
          effects: [...entry.effects, nextEffect],
        }
      }),
    )
  }

  function removeEffect(characterId: string, effectId: string) {
    setInitiativeOrder((prev) =>
      prev.map((entry) => {
        if (entry.character.id !== characterId) return entry

        return {
          ...entry,
          effects: entry.effects.filter((effect) => effect.id !== effectId),
        }
      }),
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
    applyEffect,
    removeEffect,
    removeFromInitiative,
    clearInitiative,
    nextTurn,
  }
}