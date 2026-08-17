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
 * @deprecated Do not mount this bridge inside an active session.
 *
 * It writes session-state character mutations into the relational
 * /me/characters owner record. User characters and session characters are now
 * intentionally independent copies, so active-session layouts must persist only
 * their own session state.
 *
 * Kept temporarily for migration tooling that may still need an explicit,
 * one-off projection. It must not be part of the normal session render tree.
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
