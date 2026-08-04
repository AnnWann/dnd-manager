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
  const characterContext =
    useCharacterContext()

  const { userKey } = useSyncContext()

  const owners =
    characterContext.knownPlayerKeys.map(
      (key) => characterContext.getOwner(key),
    )

  const currentOwner =
    userKey.trim()
      ? characterContext.getOwner(
          userKey.trim(),
        )
      : undefined

  const value: CharacterWorkspaceValue = {
    mode: "campaign",

    characters:
      characterContext.visibleCharacters,

    activeCharacter:
      characterContext.activeCharacter,

    selectedCharacterId:
      characterContext.activeCharacter?.get("id"),

    setSelectedCharacterId:
      characterContext.setSelectedCharacterId,

    updateCharacter:
      characterContext.updateCharacter,

    deleteCharacter: (characterId) => {
      characterContext.setSelectedCharacterId(
        characterId,
      )
      characterContext.deleteCharacter()
    },

    importCharacter:
      characterContext.importCharacter,

    completeLongRest:
      characterContext.completeLongRest,

    partyInventory:
      characterContext.partyInventory,

    canAssignOwners:
      characterContext.canAssignOwners,

    canEditCharacterType:
      characterContext.canEditCharacterType,

    owners,
    currentOwner,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      {children}
    </CharacterWorkspaceProvider>
  )
}