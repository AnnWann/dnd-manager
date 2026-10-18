import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import { CharacterProgressionFlow } from "../../features/characters/progression/CharacterProgressionFlow"
import { SessionCharacterWorkspace } from "../../features/characters/workspace/CampaignCharacterWorkspace"
import { useCharacterWorkspace } from "../../features/characters/workspace/CharacterWorkspaceContext"
import { useOptionalSessionRuntime } from "../../features/session-runtime/useSessionRuntime"
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
  const sessionRuntime = useOptionalSessionRuntime()
  const [error, setError] = useState("")
  const { characters, setSelectedCharacterId } = useCharacterWorkspace()
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
    <div className="grid gap-4">
      {error ? (
        <div className="rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <CharacterProgressionFlow
        mode="level-up"
        character={preparedCharacter}
        onCancel={() => navigate(returnPath)}
        onComplete={(updated) => {
          setError("")

          if (
            !sessionRuntime ||
            sessionRuntime.role !== "MASTER" ||
            sessionRuntime.status !== "connected"
          ) {
            setError(
              "A subida de nível dentro da sessão precisa ser aplicada pelo mestre com o Session Server conectado.",
            )
            return
          }

          const sent = sessionRuntime.dispatchCharacterLifecycleOperation({
            type: "character.session.resync",
            characterId,
            character: updated.toJSON(),
          })

          if (!sent) {
            setError("Não foi possível enviar a subida de nível para a sessão.")
            return
          }

          navigate(returnPath, { replace: true })
        }}
      />
    </div>
  )
}
