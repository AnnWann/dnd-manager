import { useEffect, useRef, useState } from "react"

import { getSessionHomebrew } from "../../api/session-homebrew"
import { useCharacterContext } from "../../contexts/characterContext"
import {
  LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
  LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE,
} from "../../shared/legacy/legacyCampaignBackup"
import { legacyCharacterIdentitySignature } from "../../shared/legacy/legacyCharacterIdentity"
import { useOptionalSessionRuntime } from "./useSessionRuntime"

type LegacyImportState = "checking" | "legacy" | "regular"

/**
 * The relational character snapshot is only an entry seed. As soon as the
 * MASTER socket connects and the existing lifecycle snapshot is known, copy
 * only missing characters into the Durable Object. Waiting for the snapshot
 * prevents reconnects from racing the server and re-adding active characters.
 *
 * Imported legacy campaigns also get a one-time identity reconciliation pass.
 * Only structurally unique session-only/canonical pairs are proposed; the
 * server independently validates every pair before mutating persisted state.
 */
export function SessionAuthoritativeBootstrap({ campaignId }: { campaignId: string }) {
  const runtime = useOptionalSessionRuntime()
  const { visibleCharacters } = useCharacterContext()
  const [legacyImportState, setLegacyImportState] = useState<LegacyImportState>("checking")
  const attemptedReconciliations = useRef(new Set<string>())

  useEffect(() => {
    attemptedReconciliations.current.clear()

    if (runtime?.role !== "MASTER") {
      setLegacyImportState("regular")
      return
    }

    let cancelled = false
    setLegacyImportState("checking")

    void getSessionHomebrew(campaignId)
      .then((catalog) => {
        if (cancelled) return
        const isLegacyImport = catalog.assets.some(
          (asset) =>
            asset.type === LEGACY_SESSION_BOOTSTRAP_ASSET_TYPE &&
            asset.sourceId === LEGACY_SESSION_BOOTSTRAP_ASSET_SOURCE,
        )
        setLegacyImportState(isLegacyImport ? "legacy" : "regular")
      })
      .catch((error) => {
        if (cancelled) return
        console.error("[session-runtime] failed to identify legacy session import", error)
        setLegacyImportState("regular")
      })

    return () => {
      cancelled = true
    }
  }, [campaignId, runtime?.role])

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

  useEffect(() => {
    if (
      !runtime ||
      runtime.status !== "connected" ||
      runtime.role !== "MASTER" ||
      !runtime.characterSnapshotReady ||
      !runtime.runtimeConfigSnapshot ||
      legacyImportState !== "legacy" ||
      visibleCharacters.length === 0
    ) {
      return
    }

    const canonicalIds = new Set(
      visibleCharacters.map((character) => character.get("id")),
    )
    const canonicalBySignature = uniqueCharacterIdsBySignature(
      visibleCharacters.map((character) => ({
        characterId: character.get("id"),
        character: character.toJSON(),
      })),
    )
    const sessionOnlyBySignature = uniqueCharacterIdsBySignature(
      Object.values(runtime.abilitiesByCharacterId)
        .filter((state) => state.initialized)
        .filter((state) => !canonicalIds.has(state.characterId))
        .filter(
          (state) => runtime.sessionCharactersById[state.characterId]?.active !== false,
        )
        .map((state) => ({
          characterId: state.characterId,
          character: state.character,
        })),
    )

    const pairs: Array<{ sourceCharacterId: string; targetCharacterId: string }> = []
    for (const [signature, targetCharacterId] of canonicalBySignature) {
      const sourceCharacterId = sessionOnlyBySignature.get(signature)
      if (!sourceCharacterId || sourceCharacterId === targetCharacterId) continue

      const targetAbility = runtime.abilitiesByCharacterId[targetCharacterId]
      if (!targetAbility?.initialized) continue
      if (runtime.sessionCharactersById[targetCharacterId]?.active === false) continue

      const attemptKey = `${sourceCharacterId}->${targetCharacterId}`
      if (attemptedReconciliations.current.has(attemptKey)) continue
      pairs.push({ sourceCharacterId, targetCharacterId })
    }

    if (!pairs.length) return
    const sent = runtime.dispatchCharacterLifecycleOperation({
      type: "character.session.reconcile",
      characterId: "session",
      pairs,
    })
    if (sent) {
      for (const pair of pairs) {
        attemptedReconciliations.current.add(
          `${pair.sourceCharacterId}->${pair.targetCharacterId}`,
        )
      }
    }
  }, [
    legacyImportState,
    runtime?.abilitiesByCharacterId,
    runtime?.characterSnapshotReady,
    runtime?.dispatchCharacterLifecycleOperation,
    runtime?.role,
    runtime?.runtimeConfigSnapshot,
    runtime?.sessionCharactersById,
    runtime?.status,
    visibleCharacters,
  ])

  return null
}

function uniqueCharacterIdsBySignature(
  characters: Array<{
    characterId: string
    character: Record<string, unknown>
  }>,
): Map<string, string> {
  const grouped = new Map<string, string[]>()

  for (const entry of characters) {
    const signature = legacyCharacterIdentitySignature(entry.character)
    if (!signature) continue
    const current = grouped.get(signature) ?? []
    current.push(entry.characterId)
    grouped.set(signature, current)
  }

  return new Map(
    [...grouped.entries()].flatMap(([signature, ids]) =>
      ids.length === 1 ? [[signature, ids[0]] as const] : [],
    ),
  )
}
