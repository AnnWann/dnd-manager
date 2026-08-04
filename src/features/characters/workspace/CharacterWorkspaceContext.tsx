import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"

export type CharacterWorkspaceMode =
  | "campaign"
  | "user"

export type CharacterWorkspaceValue = {
  mode: CharacterWorkspaceMode

  characters: CharacterTemplate[]
  activeCharacter?: CharacterTemplate
  selectedCharacterId?: string

  setSelectedCharacterId: (
    characterId: string,
  ) => void

  updateCharacter: (
    characterId: string,
    updater: (
      character: CharacterTemplate,
    ) => CharacterTemplate,
  ) => void

  deleteCharacter: (
    characterId: string,
  ) => void

  importCharacter?: (
    rawCharacter: unknown,
  ) => CharacterTemplate

  completeLongRest?: (
    characterId: string,
  ) => void

  partyInventory?: unknown[]

  canAssignOwners: boolean
  canEditCharacterType: boolean

  owners: Player[]
  currentOwner?: Player
}

const CharacterWorkspaceContext =
  createContext<CharacterWorkspaceValue | null>(
    null,
  )

export function CharacterWorkspaceProvider({
  value,
  children,
}: {
  value: CharacterWorkspaceValue
  children: ReactNode
}) {
  return (
    <CharacterWorkspaceContext.Provider
      value={value}
    >
      {children}
    </CharacterWorkspaceContext.Provider>
  )
}

export function useCharacterWorkspace() {
  const context = useContext(
    CharacterWorkspaceContext,
  )

  if (!context) {
    throw new Error(
      "useCharacterWorkspace precisa estar dentro de CharacterWorkspaceProvider.",
    )
  }

  return context
}