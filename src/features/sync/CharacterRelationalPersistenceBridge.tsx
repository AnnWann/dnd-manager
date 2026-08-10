import { useEffect, useMemo, useRef } from "react"

import type { AppStateV1 } from "../../lib/remoteState"
import { CharacterRelationalPersistence } from "../../lib/characterRelationalPersistence"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../models/characters/CharacterTemplate"

type Props = {
  state: AppStateV1
  syncKey: string
  actorKey: string
}

/**
 * Transitional write-through bridge.
 *
 * AppState remains the optimistic UI/cache layer, but every character mutation
 * is persisted through the independently versioned relational owner domain.
 * This lets existing screens migrate incrementally without keeping the server
 * write boundary monolithic.
 */
export function CharacterRelationalPersistenceBridge({
  state,
  syncKey,
  actorKey,
}: Props) {
  const previousRef = useRef<Map<string, CharacterTemplateProps>>(new Map())
  const persistence = useMemo(
    () =>
      syncKey.trim().length >= 12
        ? new CharacterRelationalPersistence(syncKey, actorKey)
        : null,
    [actorKey, syncKey],
  )

  useEffect(() => {
    previousRef.current = new Map()
  }, [persistence])

  useEffect(() => {
    if (!persistence) return

    const previous = previousRef.current
    const current = new Map<string, CharacterTemplateProps>()

    for (const raw of state.characters ?? []) {
      const character = CharacterTemplate.fromJSON(raw).toJSON()
      current.set(character.id, character)

      const before = previous.get(character.id)
      if (!before) {
        void persistence.bootstrap(character).catch((error) => {
          console.error(
            `Falha ao inicializar persistência modular de ${character.id}.`,
            error,
          )
        })
        continue
      }

      persistence.persistChange(before, character)
    }

    for (const characterId of previous.keys()) {
      if (!current.has(characterId)) persistence.remove(characterId)
    }

    previousRef.current = current
  }, [persistence, state.characters])

  return null
}
