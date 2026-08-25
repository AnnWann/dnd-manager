import { Navigate, useParams } from "react-router-dom"

/**
 * Compatibility route for the old dedicated level-up workspace.
 * Level-up now lives inside UserCharacterDetailView so the same edit draft and
 * edit-mode state survive navigation into and out of progression.
 */
export function UserCharacterLevelUpView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) return <Navigate to="/not-found" replace />

  return (
    <Navigate
      to={`/user/characters/${encodeURIComponent(characterId)}/level-up-editor`}
      replace
    />
  )
}
