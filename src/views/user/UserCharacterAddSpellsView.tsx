import { Navigate, useNavigate, useParams } from "react-router-dom"

import { OnDemandCharacterSpellLibrary } from "../../features/characters/magic/OnDemandCharacterSpellLibrary"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"

export function UserCharacterAddSpellsView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <UserCharacterWorkspace characterId={characterId}>
      <UserCharacterAddSpellsContent characterId={characterId} />
    </UserCharacterWorkspace>
  )
}

function UserCharacterAddSpellsContent({
  characterId,
}: {
  characterId: string
}) {
  const navigate = useNavigate()
  const {
    characters,
    isEditing,
    updateCharacter,
    saveCharacter,
  } = useCharacterWorkspace()
  const character = characters.find(
    (entry) => entry.get("id") === characterId,
  )
  const spellListPath = `/user/characters/${encodeURIComponent(characterId)}/spells-list`

  if (!character) {
    return <Navigate to="/not-found" replace />
  }

  if (!isEditing) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-textMuted">
        Ative o modo de edição acima para adicionar magias a este personagem.
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <OnDemandCharacterSpellLibrary
        character={character}
        updateCharacter={updateCharacter}
        onCancel={() => navigate(spellListPath)}
        onSpellAdded={() => {
          void saveCharacter?.().then((saved) => {
            if (saved) navigate(spellListPath)
          })
        }}
      />
    </div>
  )
}
