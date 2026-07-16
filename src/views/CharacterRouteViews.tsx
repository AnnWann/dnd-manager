import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useCharacterContext } from '../contexts/characterContext'
import {
  readLocalStorageJson,
  writeLocalStorageJson,
} from '../lib/storage'
import { CharacterView } from './CharacterView'

const LAST_OPENED_CHARACTER_KEY = 'dndmm.lastOpenedCharacter.v1'

type LastOpenedCharacterCache = {
  characterId: string
  savedAt: number
}

type CharacterIndexLocationState = {
  autoOpenLast?: boolean
}

export function CharacterIndexView() {
  const { visibleCharacters } = useCharacterContext()
  const location = useLocation()
  const navigate = useNavigate()

  const shouldAutoOpen =
    location.key === 'default' ||
    Boolean((location.state as CharacterIndexLocationState | null)?.autoOpenLast)

  const cachedCharacter = useMemo(() => {
    if (!shouldAutoOpen) return undefined

    const cached = readLocalStorageJson<LastOpenedCharacterCache>(
      LAST_OPENED_CHARACTER_KEY,
    )
    if (!cached?.characterId) return undefined

    return visibleCharacters.find(
      (character) => character.get('id') === cached.characterId,
    )
  }, [shouldAutoOpen, visibleCharacters])

  useEffect(() => {
    if (!shouldAutoOpen || !cachedCharacter) return

    navigate(characterPath(cachedCharacter.get('id'), 'sheet'), {
      replace: true,
      state: null,
    })
  }, [cachedCharacter, navigate, shouldAutoOpen])

  if (shouldAutoOpen && cachedCharacter) return null
  return <CharacterView />
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

  return <CharacterView />
}

function characterPath(characterId: string, tab: string): string {
  return `/character/${encodeURIComponent(characterId)}/${encodeURIComponent(tab)}`
}
