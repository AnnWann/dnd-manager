import {
  Navigate,
  useParams,
} from "react-router-dom"

import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"
import { CharacterView } from "../CharacterView"

export function UserCharacterDetailView() {
  const { characterId } =
    useParams<{
      characterId?: string
    }>()

  if (!characterId) {
    return (
      <Navigate
        to="/not-found"
        replace
      />
    )
  }

  return (
    <UserCharacterWorkspace
      characterId={characterId}
    >
      <CharacterView />
    </UserCharacterWorkspace>
  )
}