import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"

import {
  getCampaignSessionCharacters,
  type CampaignSessionCharacters,
} from "../../api/campaign-session"
import { useCharacterContext } from "../../contexts/characterContext"
import { CharacterSelectorList } from "../../features/characters/selector/CharacterSelectorList"
import { toSessionCharacterSelectorItem } from "../../features/characters/selector/sessionCharacterSelectorAdapter"
import { sessionCharacterPath } from "../../lib/campaignRoutes"

export function CampaignCharactersView() {
  const { campaignId } = useParams<{ campaignId?: string }>()
  const navigate = useNavigate()
  const {
    visibleCharacters,
    activeCharacter,
    setSelectedCharacterId,
  } = useCharacterContext()
  const [data, setData] = useState<CampaignSessionCharacters | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    async function loadCharacters() {
      setLoading(true)
      setErrorMessage("")

      try {
        const nextData = await getCampaignSessionCharacters(campaignId!)
        if (!cancelled) setData(nextData)
      } catch {
        if (!cancelled) {
          setData(null)
          setErrorMessage("Não foi possível carregar os personagens da sessão.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCharacters()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const sessionCharacters = useMemo(() => {
    if (!data) return []

    const linkedSourceIds = new Set(
      data.characters.map((character) => character.id),
    )

    return visibleCharacters.filter((character) =>
      linkedSourceIds.has(character.get("id")),
    )
  }, [data, visibleCharacters])

  const selectorCharacters = useMemo(
    () => sessionCharacters.map(toSessionCharacterSelectorItem),
    [sessionCharacters],
  )

  if (!campaignId) return <Navigate to="/not-found" replace />

  return (
    <CharacterSelectorList
      title="Personagens"
      description="Clique uma vez para selecionar e novamente para abrir a ficha."
      characters={selectorCharacters}
      selectedCharacterId={activeCharacter?.get("id") ?? ""}
      loading={loading}
      errorMessage={errorMessage}
      emptyMessage="Nenhum personagem disponível."
      onSelectCharacter={setSelectedCharacterId}
      onOpenCharacter={(characterId) =>
        navigate(sessionCharacterPath(campaignId, characterId, "sheet"))
      }
    />
  )
}
