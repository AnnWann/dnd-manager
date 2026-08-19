import type { ReactNode } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import {
  CharacterWorkspaceProvider,
  type CharacterWorkspaceValue,
} from "./CharacterWorkspaceContext"

/**
 * Mutable character copy owned by an active session.
 *
 * Session characters live in the session state and are intentionally distinct
 * from the relational source characters exposed by UserCharacterWorkspace.
 * Mutations performed here must never write to /me/characters.
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
    dispatchStatOperation: characterContext.dispatchStatOperation,
    dispatchAttributeOperation: characterContext.dispatchAttributeOperation,
    dispatchSavingThrowOperation: characterContext.dispatchSavingThrowOperation,
    dispatchSkillOperation: characterContext.dispatchSkillOperation,
    dispatchConditionOperation: characterContext.dispatchConditionOperation,
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
