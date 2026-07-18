import { useEffect, useMemo, useRef } from 'react'
import { useCustomSystemsContext } from '../../contexts/customSystemsContext'
import { useSyncContext } from '../../contexts/syncContext'
import type { AppStateV1 } from '../../lib/remoteState'

type Props = {
  state: AppStateV1
}

const MIGRATION_DELAY_MS = 1200

/**
 * Temporary compatibility bridge.
 *
 * The legacy state remains the UI source of truth while this component projects
 * characters, homebrew spells and custom systems into the relational v2 schema.
 * Once each feature reads directly from its repository this bridge can be removed.
 */
export function RelationalMigrationBridge({ state }: Props) {
  const { syncKey, userKey, userRole, canSync } = useSyncContext()
  const { definitions } = useCustomSystemsContext()
  const requestRef = useRef<AbortController | null>(null)

  const payload = useMemo(() => ({
    characters: state.characters,
    spells: state.spells ?? [],
    systems: definitions,
    userKey,
  }), [definitions, state.characters, state.spells, userKey])

  useEffect(() => {
    if (!canSync || userRole !== 'master') return

    const timer = window.setTimeout(() => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller

      void fetch(`/api/v2/migrate?key=${encodeURIComponent(syncKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).then(async (response) => {
        if (response.ok) return
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || `HTTP ${response.status}`)
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Relational migration bridge failed', error)
      })
    }, MIGRATION_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
      requestRef.current?.abort()
    }
  }, [canSync, payload, syncKey, userRole])

  return null
}
