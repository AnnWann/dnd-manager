import { Navigate, useNavigate, useParams } from "react-router-dom"

import { CharacterProgressionFlow } from "../../features/characters/progression/CharacterProgressionFlow"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"
import { prepareCharacterForProgression } from "../../models/leveling/prepareCharacterForProgression"

export function UserCharacterLevelUpView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) return <Navigate to="/not-found" replace />

  return (
    <UserCharacterWorkspace characterId={characterId} initialEditing>
      <LevelUpContent />
    </UserCharacterWorkspace>
  )
}

function LevelUpContent() {
  const navigate = useNavigate()
  const { activeCharacter, updateCharacter, saveCharacter } = useCharacterWorkspace()

  if (!activeCharacter) return null

  const characterId = activeCharacter.get("id")
  const returnPath = `/user/characters/${encodeURIComponent(characterId)}/sheet`
  const preparedCharacter = prepareCharacterForProgression(activeCharacter)

  return (
    <CharacterProgressionFlow
      mode="level-up"
      character={preparedCharacter}
      onCancel={() => navigate(returnPath)}
      onComplete={(updated) => {
        updateCharacter(characterId, () => updated)
        void saveCharacter?.().then((saved) => {
          if (saved) navigate(returnPath, { replace: true })
        })
      }}
    />
  )
}
