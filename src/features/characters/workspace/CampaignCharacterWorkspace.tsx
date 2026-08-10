import type { ReactNode } from "react"

import { useCharacterContext } from "../../../contexts/characterContext"
import { useSyncContext } from "../../../contexts/syncContext"
import {
  CharacterWorkspaceProvider,
  type CharacterWorkspaceValue,
} from "./CharacterWorkspaceContext"

export function CampaignCharacterWorkspace({
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
