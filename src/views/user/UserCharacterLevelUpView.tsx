import { Navigate, useNavigate, useParams } from "react-router-dom"

import { CharacterLevelUpWizard } from "../../features/characters/levelUp/CharacterLevelUpWizardV2"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"

export function UserCharacterLevelUpView() {
  const { characterId } = useParams<{ characterId?: string }>()

  if (!characterId) return <Navigate to="/not-found" replace />

  return (
    <UserCharacterWorkspace characterId={characterId}>
      <LevelUpContent />
    </UserCharacterWorkspace>
  )
}

function LevelUpContent() {
  const navigate = useNavigate()
  const { activeCharacter, updateCharacter } = useCharacterWorkspace()

  if (!activeCharacter) return null

  const characterId = activeCharacter.get("id")
  const returnPath = `/user/characters/${encodeURIComponent(characterId)}/sheet`

  return (
    <CharacterLevelUpWizard
      character={activeCharacter}
      onCancel={() => navigate(returnPath)}
      onComplete={(updated) => {
        updateCharacter(characterId, () => updated)
        navigate(returnPath, { replace: true })
      }}
    />
  )
}
