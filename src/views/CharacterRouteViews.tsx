import { useEffect, useMemo } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import { CharacterSpellRuntime } from "../features/characters/workspace/CharacterSpellRuntime"
import { useCharacterWorkspace } from "../features/characters/workspace/CharacterWorkspaceContext"
import { SessionCharacterWorkspace } from "../features/characters/workspace/SessionCharacterWorkspace"
import { sessionCharacterPath } from "../lib/campaignRoutes"
import {
  readLocalStorageJson,
  writeLocalStorageJson,
} from "../lib/storage"
import { CharacterView } from "./CharacterView"

const LAST_OPENED_CHARACTER_KEY = "dndmm.lastOpenedCharacter.v1"

type LastOpenedCharacterCache = {
  characterId: string
  savedAt: number
}

type CharacterIndexLocationState = {
  autoOpenLast?: boolean
}

export function CharacterIndexView() {
  return (
    <SessionCharacterWorkspace>
      <CharacterIndexContent />
    </SessionCharacterWorkspace>
  )
}

function CharacterIndexContent() {
  const { characters } = useCharacterWorkspace()
  const { campaignId = "" } = useParams<{ campaignId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const shouldAutoOpen =
    location.key === "default" ||
    Boolean(
      (location.state as CharacterIndexLocationState | null)?.autoOpenLast,
    )

  const cachedCharacter = useMemo(() => {
    if (!shouldAutoOpen) return undefined

    const cached = readLocalStorageJson<LastOpenedCharacterCache>(
      LAST_OPENED_CHARACTER_KEY,
    )
    if (!cached?.characterId) return undefined

    return characters.find(
      (character) => character.get("id") === cached.characterId,
    )
  }, [characters, shouldAutoOpen])

  useEffect(() => {
    if (!shouldAutoOpen || !cachedCharacter || !campaignId) return

    navigate(
      sessionCharacterPath(campaignId, cachedCharacter.get("id"), "sheet"),
      {
        replace: true,
        state: null,
      },
    )
  }, [cachedCharacter, campaignId, navigate, shouldAutoOpen])

  if (shouldAutoOpen && cachedCharacter) return null

  return (
    <CharacterSpellRuntime>
      <CharacterView />
    </CharacterSpellRuntime>
  )
}

export function CharacterDetailView() {
  const { characterId } = useParams<{ characterId?: string }>()

  useEffect(() => {
    if (!characterId) return

    writeLocalStorageJson(LAST_OPENED_CHARACTER_KEY, {
      characterId,
      savedAt: Date.now(),
    } satisfies LastOpenedCharacterCache)
  }, [characterId])

  if (!characterId) return null

  return (
    <SessionCharacterWorkspace>
      <CharacterSpellRuntime>
        <CharacterView />
      </CharacterSpellRuntime>
    </SessionCharacterWorkspace>
  )
}
