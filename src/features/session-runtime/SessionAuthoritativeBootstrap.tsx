import { useEffect } from "react"

import { useCharacterContext } from "../../contexts/characterContext"
import { useOptionalSessionRuntime } from "./useSessionRuntime"

/**
 * The relational character snapshot is only an entry seed. As soon as the
 * MASTER socket connects, copy missing characters into the Durable Object so
 * every active-session screen can read the authoritative character snapshot
 * from WebSocket state instead of going back to Postgres.
 */
export function SessionAuthoritativeBootstrap() {
  const runtime = useOptionalSessionRuntime()
  const { visibleCharacters } = useCharacterContext()

  useEffect(() => {
    if (
      !runtime ||
      runtime.status !== "connected" ||
      runtime.role !== "MASTER" ||
      visibleCharacters.length === 0
    ) {
      return
    }

    runtime.initializeAbilities(
      visibleCharacters.map((character) => ({
        characterId: character.get("id"),
        character: character.toJSON(),
      })),
    )
  }, [
    runtime?.initializeAbilities,
    runtime?.role,
    runtime?.status,
    visibleCharacters,
  ])

  return null
}
