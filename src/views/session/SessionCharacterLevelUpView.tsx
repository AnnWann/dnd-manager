import { useEffect } from "react"
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
      <LevelUpContent sessionId={campaignId} characterId={characterId} />
    </SessionCharacterWorkspace>
  )
}

function LevelUpContent({
  sessionId,
  characterId,
}: {
  sessionId: string
  characterId: string
}) {
  const navigate = useNavigate()
  const { characters, setSelectedCharacterId, updateCharacter } = useCharacterWorkspace()
  const character = characters.find((entry) => entry.get("id") === characterId)

  useEffect(() => {
    if (character) setSelectedCharacterId(characterId)
  }, [character, characterId, setSelectedCharacterId])

  if (!character) {
    return (
      <div className="grid min-h-64 place-items-center text-sm text-textMuted">
        Personagem da sessão não encontrado.
      </div>
    )
  }

  const returnPath = sessionCharacterPath(sessionId, characterId, "sheet")
  const preparedCharacter = prepareCharacterForProgression(character)

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
