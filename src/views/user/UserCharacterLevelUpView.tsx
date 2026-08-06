import { Navigate, useNavigate, useParams } from "react-router-dom"

import { CharacterProgressionFlow } from "../../features/characters/progression/CharacterProgressionFlow"
import { LevelUpSpellSelectionModal } from "../../features/characters/progression/LevelUpSpellSelectionModal"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { UserCharacterWorkspace } from "../../features/characters/workspace/UserCharacterWorkspace"
import { materializeProgressionChoices } from "../../models/leveling/materializeProgressionChoices"
import { prepareCharacterForProgression } from "../../models/leveling/prepareCharacterForProgression"
import { refreshProgressionFeatureMechanics } from "../../models/leveling/refreshProgressionFeatureMechanics"

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
  const preparedCharacter = prepareCharacterForProgression(activeCharacter)

  return (
    <>
      <CharacterProgressionFlow
        mode="level-up"
        character={preparedCharacter}
        onCancel={() => navigate(returnPath)}
        onComplete={(updated) => {
          const finalized = refreshProgressionFeatureMechanics(
            materializeProgressionChoices(updated),
          )
          updateCharacter(characterId, () => finalized)
          navigate(returnPath, { replace: true })
        }}
      />
      <LevelUpSpellSelectionModal />
    </>
  )
}
