import {
  createContext,
  useContext,
  type ReactNode,
} from "react"

import type { TransferItemRequest } from "../../../contexts/characterContext"
import type {
  SessionAttributeOperation,
  SessionConditionOperation,
  SessionSavingThrowOperation,
  SessionSkillOperation,
  SessionStatOperation,
} from "../../session-runtime/sessionProtocol"
import type { CharacterDomainName } from "../../../lib/relationalApi"
import type {
  EquippedItemDestination,
  EquippedItemReference,
} from "../../../models/characters/characterEquippedItemMovement"
import type { HandOccupantReference } from "../../../models/characters/characterHands"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { GameOperation } from "../../../models/game/GameOperation"
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
  updateCharacterDomain: (
    characterId: string,
    domain: CharacterDomainName,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void

  /**
   * Transport boundary for sheet domains already owned by the session server.
   * Campaign workspaces consume the operation even when the socket is offline,
   * preventing an authoritative action from falling through to local mutation.
   * User workspaces return false so controls persist through HTTPS instead.
   */
  dispatchStatOperation: (operation: SessionStatOperation) => boolean
  dispatchAttributeOperation: (operation: SessionAttributeOperation) => boolean
  dispatchSavingThrowOperation: (operation: SessionSavingThrowOperation) => boolean
  dispatchSkillOperation: (operation: SessionSkillOperation) => boolean
  dispatchConditionOperation: (operation: SessionConditionOperation) => boolean

  dispatchGameOperation?: (operation: GameOperation) => void
  deleteCharacter: (characterId: string) => void
  importCharacter?: (rawCharacter: unknown) => CharacterTemplate
  completeLongRest: (
    characterId: string,
    selection: LongRestSupplySelection[],
  ) => void

  partyInventory: Itemmable[]

  stowHandOccupant: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  moveEquippedItem: (
    characterId: string,
    reference: EquippedItemReference,
    destination: Exclude<EquippedItemDestination, "ground">,
  ) => void
  dropHandOccupant?: (
    characterId: string,
    reference: HandOccupantReference,
  ) => void
  moveEquippedItemToGround?: (
    characterId: string,
    reference: EquippedItemReference,
  ) => void
  addGroundItem?: (item: Itemmable) => void
  canUseGroundInventory: boolean

  transferCharacters?: CharacterTemplate[]
  transferItem?: (request: TransferItemRequest) => void
  canTransferFromCharacter?: (characterId: string) => boolean
  canViewCharacterDetails?: (characterId: string) => boolean

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
