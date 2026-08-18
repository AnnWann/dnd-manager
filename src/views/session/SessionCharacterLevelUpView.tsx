import { Navigate, useNavigate, useParams } from "react-router-dom"

import { CharacterProgressionFlow } from "../../features/characters/progression/CharacterProgressionFlow"
import { SessionCharacterWorkspace } from "../../features/characters/workspace/CampaignCharacterWorkspace"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { sessionCharacterPath } from "../../lib/campaignRoutes"
import { prepareCharacterForProgression } from "../../models/leveling/prepareCharacterForProgression"

export function SessionCharacterLevelUpView() {
  const { campaignId, characterId } = useParams<{
    campaignId?: string
    characterId?: string
  }>()

  if (!campaignId || !characterId) {
    return <Navigate to="/not-found" replace />
  }

  return (
    <SessionCharacterWorkspace>
      <LevelUpContent sessionId={campaignId} />
    </SessionCharacterWorkspace>
  )
}

function LevelUpContent({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const { activeCharacter, updateCharacter } = useCharacterWorkspace()

  if (!activeCharacter) return null

  const characterId = activeCharacter.get("id")
  const returnPath = sessionCharacterPath(sessionId, characterId, "sheet")
  const preparedCharacter = prepareCharacterForProgression(activeCharacter)

  return (
    <CharacterProgressionFlow
      mode="level-up"
      character={preparedCharacter}
      onCancel={() => navigate(returnPath)}
      onComplete={(updated) => {
        updateCharacter(characterId, () => updated)
        navigate(returnPath, { replace: true })
      }}
    />
  )
}
