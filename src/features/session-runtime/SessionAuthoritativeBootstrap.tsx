import { useEffect } from "react"

import { useCharacterContext } from "../../contexts/characterContext"
import { useOptionalSessionRuntime } from "./useSessionRuntime"

/**
 * The relational character snapshot is only an entry seed. As soon as the
 * MASTER socket connects and the existing lifecycle snapshot is known, copy
 * only missing characters into the Durable Object. Waiting for the snapshot
 * prevents reconnects from racing the server and re-adding active characters.
 */
export function SessionAuthoritativeBootstrap() {
  const runtime = useOptionalSessionRuntime()
  const { visibleCharacters } = useCharacterContext()

  useEffect(() => {
    if (
      !runtime ||
      runtime.status !== "connected" ||
      runtime.role !== "MASTER" ||
      !runtime.characterSnapshotReady ||
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
    runtime?.characterSnapshotReady,
    runtime?.initializeAbilities,
    runtime?.role,
    runtime?.status,
    visibleCharacters,
  ])

  return null
}
