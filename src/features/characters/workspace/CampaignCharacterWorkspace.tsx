import type { ReactNode } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import {
  CharacterWorkspaceProvider,
  type CharacterWorkspaceValue,
} from "./CharacterWorkspaceContext"

/**
 * Workspace for the mutable character copy that lives inside an active session.
 *
 * This deliberately uses CharacterContext/session state instead of the relational
 * /me/characters persistence used by UserCharacterWorkspace. Changes made here
 * must never write through to the user's source character.
 */
export function SessionCharacterWorkspace({
  children,
}: {
  children: ReactNode
}) {
  const characterContext = useCharacterContext()
  const { userKey } = useSyncContext()

  const owners = characterContext.knownPlayerKeys.map((key) =>
    characterContext.getOwner(key),
  )

  const normalizedUserKey = userKey.trim()
  const currentOwner = normalizedUserKey
    ? characterContext.getOwner(normalizedUserKey)
    : undefined

  const value: CharacterWorkspaceValue = {
    mode: "campaign",
    characters: characterContext.visibleCharacters,
    activeCharacter: characterContext.activeCharacter,
    selectedCharacterId: characterContext.activeCharacter?.get("id"),
    setSelectedCharacterId: characterContext.setSelectedCharacterId,
    updateCharacter: characterContext.updateCharacter,
    updateCharacterDomain: characterContext.updateCharacterDomain,
    dispatchGameOperation: characterContext.dispatchGameOperation,
    deleteCharacter: characterContext.deleteCharacter,
    importCharacter: characterContext.importCharacter,
    completeLongRest: characterContext.completeLongRest,
    partyInventory: characterContext.partyInventory,
    stowHandOccupant: characterContext.stowHandOccupant,
    moveEquippedItem: (characterId, reference, destination) =>
      characterContext.moveEquippedItem(
        characterId,
        reference,
        destination,
      ),
    dropHandOccupant: characterContext.dropHandOccupant,
    moveEquippedItemToGround: (characterId, reference) =>
      characterContext.moveEquippedItem(
        characterId,
        reference,
        "ground",
      ),
    addGroundItem: characterContext.addGroundItem,
    canUseGroundInventory: true,
    transferCharacters: characterContext.transferCharacters,
    transferItem: characterContext.transferItem,
    canTransferFromCharacter: characterContext.canTransferFromCharacter,
    canViewCharacterDetails: characterContext.canViewCharacterDetails,
    canAssignOwners: characterContext.canAssignOwners,
    canEditCharacterType: characterContext.canEditCharacterType,
    owners,
    currentOwner,
    knownPlayerKeys: characterContext.knownPlayerKeys,
    getOwner: characterContext.getOwner,
    createOwner: characterContext.createOwner,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      {children}
    </CharacterWorkspaceProvider>
  )
}

/** @deprecated Use SessionCharacterWorkspace for active-session character UI. */
export const CampaignCharacterWorkspace = SessionCharacterWorkspace
