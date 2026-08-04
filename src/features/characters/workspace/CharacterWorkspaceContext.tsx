import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import type { Player } from "../../../models/player/Player"
import type { LongRestSupplySelection } from "../../../models/supplies/partySupply"

export type CharacterWorkspaceMode = "campaign" | "user"

export type CharacterWorkspaceValue = {
  mode: CharacterWorkspaceMode

  characters: CharacterTemplate[]
  activeCharacter?: CharacterTemplate
  selectedCharacterId?: string

  setSelectedCharacterId: (characterId: string) => void
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  deleteCharacter: (characterId: string) => void
  importCharacter?: (rawCharacter: unknown) => CharacterTemplate
  completeLongRest: (
    characterId: string,
    selection: LongRestSupplySelection[],
  ) => void

  partyInventory: Itemmable[]

  canAssignOwners: boolean
  canEditCharacterType: boolean

  owners: Player[]
  currentOwner?: Player
  knownPlayerKeys: string[]
  getOwner: (ownerId: string) => Player
  createOwner: (ownerName: string) => Player
}

const CharacterWorkspaceContext =
  createContext<CharacterWorkspaceValue | null>(null)

export function CharacterWorkspaceProvider({
  value,
  children,
}: {
  value: CharacterWorkspaceValue
  children: ReactNode
}) {
  return (
    <CharacterWorkspaceContext.Provider value={value}>
      {children}
    </CharacterWorkspaceContext.Provider>
  )
}

export function useCharacterWorkspace(): CharacterWorkspaceValue {
  const context = useContext(CharacterWorkspaceContext)

  if (!context) {
    throw new Error(
      "useCharacterWorkspace precisa estar dentro de CharacterWorkspaceProvider.",
    )
  }

  return context
}
