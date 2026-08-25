import { Navigate, useParams } from "react-router-dom"

/**
 * Compatibility route. Item creation now lives inside UserCharacterView so the
 * character-wide edit mode and draft stay mounted across the whole workflow.
 */
export function UserCharacterCreateItemView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <Navigate
      to={`/user/characters/${encodeURIComponent(characterId)}/add-item`}
      replace
    />
  )
}
