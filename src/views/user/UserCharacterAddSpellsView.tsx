import { Navigate, useParams } from "react-router-dom"

/**
 * Compatibility route for the former nested add-spells page.
 *
 * The active editor now lives at /user/characters/:characterId/add-spells so
 * it stays inside UserCharacterDetailView and preserves the current character
 * draft while navigating from the spell list.
 */
export function UserCharacterAddSpellsView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <Navigate
      to={`/user/characters/${encodeURIComponent(characterId)}/add-spells`}
      replace
    />
  )
}
