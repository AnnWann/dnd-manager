import { useEffect, useMemo, useRef } from 'react'
import { useCustomSystemsContext } from '../../contexts/customSystemsContext'
import { useSyncContext } from '../../contexts/syncContext'
import type { AppStateV1 } from '../../lib/remoteState'

type Props = {
  state: AppStateV1
}

const MIGRATION_DELAY_MS = 1800
const REQUEST_PAUSE_MS = 80

/**
 * Temporary compatibility bridge.
 *
 * The legacy state remains the UI source of truth while this component projects
 * characters, homebrew spells and custom systems into the relational v2 schema.
 * Entities are sent one at a time to keep each serverless invocation short and
 * prevent a large campaign snapshot from exhausting the function runtime.
 */
export function RelationalMigrationBridge({ state }: Props) {
  const { syncKey, userKey, userRole, canSync } = useSyncContext()
  const { definitions } = useCustomSystemsContext()
  const requestRef = useRef<AbortController | null>(null)
  const lastPayloadRef = useRef('')

  const payload = useMemo(() => ({
    characters: state.characters,
    spells: state.spells ?? [],
    systems: definitions,
    userKey,
  }), [definitions, state.characters, state.spells, userKey])

  useEffect(() => {
    if (!canSync || userRole !== 'master') return

    const serialized = JSON.stringify(payload)
    if (serialized === lastPayloadRef.current) return

    const timer = window.setTimeout(() => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller

      void migrateInBatches(syncKey, payload, controller.signal)
        .then(() => {
          if (!controller.signal.aborted) lastPayloadRef.current = serialized
        })
        .catch((error: unknown) => {
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

async function migrateInBatches(
  syncKey: string,
  payload: { characters: unknown[]; spells: unknown[]; systems: unknown[]; userKey: string },
  signal: AbortSignal,
): Promise<void> {
  const jobs = [
    ...payload.characters.map((character) => ({ characters: [character] })),
    ...payload.spells.map((spell) => ({ spells: [spell] })),
    ...payload.systems.map((system) => ({ systems: [system] })),
  ]

  for (const job of jobs) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const response = await fetch(`/api/v2/migrate?key=${encodeURIComponent(syncKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chunk',
        characters: [],
        spells: [],
        systems: [],
        userKey: payload.userKey,
        ...job,
      }),
      signal,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error || `HTTP ${response.status}`)
    }

    await pause(REQUEST_PAUSE_MS, signal)
  }
}

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}
