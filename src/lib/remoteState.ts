import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CharacterTemplateProps } from '../models/characters/CharacterTemplate'
import {
  normalizeGameOperationLog,
  type GameEntityMetadata,
  type GameOperationRecord,
} from '../models/game/GameOperation'
import type { Itemmable } from '../models/items/item'
import type { Spell } from '../models/magic/spells/Spell'
import { normalizeAppStateInventory } from './normalizeAppStateInventory'
import { readLocalStorageJson, writeLocalStorageJson } from './storage'
import { mergeAppStates } from './stateMerge'

export type AppStateV1 = {
  version: 1
  /** Monotonic shared-state version independent from the schema version above. */
  stateVersion?: number
  updatedAt?: string
  updatedBy?: string
  /** Entity-level versions used by future granular sync/conflict checks. */
  entityVersions?: Record<string, GameEntityMetadata>
  /** Recent operation log. It is intentionally bounded during normalization. */
  operations?: GameOperationRecord[]
  characters: CharacterTemplateProps[]
  activeCharacterId: string
  partyInventory?: Itemmable[]
  /** Shared items currently lying on the ground. */
  groundInventory?: Itemmable[]
  /** Carrying capacity of the party vehicle, including carriage and draft animals. */
  partyCarryCapacity?: number
  /** Optional: reusable homebrew spell definitions keyed by hb:... index (synced across devices). */
  spells?: Spell[]
}

const LOCAL_STATE_KEY = 'dndmm.appState.v1'
const SYNC_KEY_STORAGE = 'dndmm.syncKey.v1'
const USER_ROLE_STORAGE = 'dndmm.userRole.v1'
const USER_KEY_STORAGE = 'dndmm.userKey.v1'
const CLIENT_ID_STORAGE = 'dndmm.clientId.v1'
const SAVE_DELAY_MS = 800
const POLL_INTERVAL_MS = 5000
const MAX_CONFLICT_RETRIES = 5

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'synced'; at: number }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

type RemoteSnapshot = {
  state: AppStateV1 | null
  revision: number
  updatedAt: string | null
  updatedBy: string | null
}

type SaveResponse = {
  ok: true
  revision: number
  updatedAt: string | null
}

class SyncConflictError extends Error {
  constructor(readonly snapshot: RemoteSnapshot) {
    super('Conflito de revisão.')
  }
}

function defaultState(): AppStateV1 {
  return {
    version: 1,
    stateVersion: 0,
    characters: [],
    activeCharacterId: '',
    partyInventory: [],
    groundInventory: [],
    partyCarryCapacity: 0,
    spells: [],
    entityVersions: {},
    operations: [],
  }
}

function getKeyFromUrl(): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  return url.searchParams.get('k') ?? url.searchParams.get('key') ?? ''
}

function removeKeyFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('k')
  url.searchParams.delete('key')
  window.history.replaceState({}, '', url.toString())
}

export function readSyncKey(): string {
  if (typeof window === 'undefined') return ''
  const fromUrl = getKeyFromUrl()
  if (fromUrl) {
    window.localStorage.setItem(SYNC_KEY_STORAGE, fromUrl)
    removeKeyFromUrl()
    return fromUrl
  }
  return window.localStorage.getItem(SYNC_KEY_STORAGE) ?? ''
}

export function writeSyncKey(key: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SYNC_KEY_STORAGE, key)
}

export function readUserRole(): 'master' | 'player' {
  if (typeof window === 'undefined') return 'player'
  return window.localStorage.getItem(USER_ROLE_STORAGE) === 'master'
    ? 'master'
    : 'player'
}

export function writeUserRole(role: 'master' | 'player'): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(USER_ROLE_STORAGE, role)
}

export function readUserKey(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(USER_KEY_STORAGE) ?? ''
}

export function writeUserKey(key: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(USER_KEY_STORAGE, key)
}

function readClientId(): string {
  if (typeof window === 'undefined') return 'server-render'
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE)?.trim()
  if (existing) return existing

  const created = crypto.randomUUID()
  window.localStorage.setItem(CLIENT_ID_STORAGE, created)
  return created
}

async function apiGetState(syncKey: string): Promise<RemoteSnapshot> {
  const response = await fetch(
    `/api/state?key=${encodeURIComponent(syncKey)}`,
    { cache: 'no-store' },
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'API /api/state não encontrada (HTTP 404). Em desenvolvimento local, use "vercel dev".',
      )
    }
    const text = await response.text().catch(() => '')
    throw new Error(text || `HTTP ${response.status}`)
  }

  const data = (await response.json()) as Partial<RemoteSnapshot>
  return {
    state: data.state ? normalizeState(data.state) : null,
    revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  }
}

async function apiPutState(
  syncKey: string,
  state: AppStateV1,
  expectedRevision: number,
  clientId: string,
): Promise<SaveResponse> {
  const response = await fetch(
    `/api/state?key=${encodeURIComponent(syncKey)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state,
        expectedRevision,
        clientId,
      }),
    },
  )

  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    state?: AppStateV1 | null
    revision?: number
    updatedAt?: string | null
    updatedBy?: string | null
    ok?: boolean
  }

  if (response.status === 409) {
    throw new SyncConflictError({
      state: data.state ? normalizeState(data.state) : null,
      revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
      updatedAt:
        typeof data.updatedAt === 'string' ? data.updatedAt : null,
      updatedBy:
        typeof data.updatedBy === 'string' ? data.updatedBy : null,
    })
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }

  return {
    ok: true,
    revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
    updatedAt:
      typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

export function useRemoteAppState() {
  const [syncKey, setSyncKey] = useState<string>(() => readSyncKey())
  const [userRole, setUserRole] = useState<'master' | 'player'>(() =>
    readUserRole(),
  )
  const [userKey, setUserKey] = useState<string>(() => readUserKey())
  const [clientId] = useState(() => readClientId())
  const [state, setState] = useState<AppStateV1>(() => {
    const local = readLocalStorageJson<AppStateV1>(LOCAL_STATE_KEY)
    return normalizeState(local)
  })
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })

  const stateRef = useRef<AppStateV1>(state)
  const baseStateRef = useRef<AppStateV1>(state)
  const revisionRef = useRef(0)
  const hydratedFromRemote = useRef(false)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const flushSaveRef = useRef<() => Promise<void>>(async () => undefined)
  const syncKeyRef = useRef(syncKey)

  useEffect(() => {
    stateRef.current = state
    writeLocalStorageJson(LOCAL_STATE_KEY, state)
  }, [state])

  useEffect(() => {
    syncKeyRef.current = syncKey
    writeSyncKey(syncKey)
  }, [syncKey])

  useEffect(() => {
    writeUserRole(userRole)
  }, [userRole])

  useEffect(() => {
    writeUserKey(userKey)
  }, [userKey])

  const canSync = useMemo(
    () => syncKey.trim().length >= 12,
    [syncKey],
  )

  const scheduleSave = useCallback((delay = SAVE_DELAY_MS) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void flushSaveRef.current()
    }, delay)
  }, [])

  const flushSave = useCallback(async () => {
    if (!canSync || !hydratedFromRemote.current) return

    if (savingRef.current) {
      dirtyRef.current = true
      return
    }

    savingRef.current = true

    try {
      while (dirtyRef.current) {
        dirtyRef.current = false
        let candidate = normalizeState(stateRef.current)
        let base = baseStateRef.current
        let expectedRevision = revisionRef.current

        if (statesEqual(candidate, base)) continue

        setStatus({ kind: 'saving' })
        let saved = false

        for (
          let attempt = 0;
          attempt < MAX_CONFLICT_RETRIES;
          attempt += 1
        ) {
          const keyAtStart = syncKeyRef.current

          try {
            const response = await apiPutState(
              keyAtStart,
              candidate,
              expectedRevision,
              clientId,
            )

            if (syncKeyRef.current !== keyAtStart) return

            revisionRef.current = response.revision
            baseStateRef.current = candidate
            saved = true
            setStatus({ kind: 'synced', at: Date.now() })
            break
          } catch (error) {
            if (!(error instanceof SyncConflictError)) throw error

            const remote = normalizeState(
              error.snapshot.state ?? defaultState(),
            )
            const localSnapshot = candidate
            const mergedSnapshot = mergeAppStates(
              base,
              localSnapshot,
              remote,
            )
            const latestLocal = normalizeState(stateRef.current)
            candidate = mergeAppStates(
              localSnapshot,
              latestLocal,
              mergedSnapshot,
            )

            base = remote
            expectedRevision = error.snapshot.revision
            baseStateRef.current = remote
            revisionRef.current = expectedRevision
            stateRef.current = candidate
            setState(candidate)
          }
        }

        if (!saved) {
          throw new Error(
            'Muitas alterações simultâneas. O estado local foi preservado; tente sincronizar novamente.',
          )
        }

        if (!statesEqual(stateRef.current, candidate)) {
          dirtyRef.current = true
        }
      }
    } catch (error) {
      dirtyRef.current = true
      setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Falha ao salvar.',
      })
    } finally {
      savingRef.current = false
      if (dirtyRef.current) scheduleSave(1200)
    }
  }, [canSync, clientId, scheduleSave])

  flushSaveRef.current = flushSave

  useEffect(() => {
    if (!canSync || !hydratedFromRemote.current) return
    if (statesEqual(state, baseStateRef.current)) return

    dirtyRef.current = true
    scheduleSave()

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [canSync, scheduleSave, state, syncKey])

  const synchronizeFromServer = useCallback(
    async (showLoading: boolean) => {
      if (!canSync) {
        if (showLoading) {
          setStatus({
            kind: 'error',
            message: 'Chave de sync inválida (mínimo 12 caracteres).',
          })
        }
        return
      }

      if (showLoading) setStatus({ kind: 'loading' })

      try {
        const keyAtStart = syncKey
        const snapshot = await apiGetState(keyAtStart)
        if (syncKeyRef.current !== keyAtStart) return

        const local = normalizeState(stateRef.current)
        const previousBase = baseStateRef.current

        if (!snapshot.state) {
          hydratedFromRemote.current = true
          revisionRef.current = 0
          baseStateRef.current = defaultState()
          dirtyRef.current = true
          scheduleSave(0)
          if (showLoading) setStatus({ kind: 'saving' })
          return
        }

        const remote = normalizeState(snapshot.state)
        const hasLocalChanges =
          hydratedFromRemote.current && !statesEqual(local, previousBase)
        const next = hasLocalChanges
          ? mergeAppStates(previousBase, local, remote)
          : {
              ...remote,
              activeCharacterId: local.activeCharacterId,
            }

        hydratedFromRemote.current = true
        revisionRef.current = snapshot.revision
        baseStateRef.current = remote
        stateRef.current = next
        setState(next)

        if (!statesEqual(next, remote)) {
          dirtyRef.current = true
          scheduleSave(0)
        } else {
          setStatus({ kind: 'synced', at: Date.now() })
        }
      } catch (error) {
        setStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Falha ao carregar.',
        })
      }
    },
    [canSync, scheduleSave, syncKey],
  )

  const pullFromServer = useCallback(
    async () => synchronizeFromServer(true),
    [synchronizeFromServer],
  )

  useEffect(() => {
    hydratedFromRemote.current = false
    revisionRef.current = 0
    baseStateRef.current = stateRef.current
    dirtyRef.current = false

    if (!canSync) return
    const timer = window.setTimeout(() => {
      void synchronizeFromServer(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [canSync, syncKey, synchronizeFromServer])

  useEffect(() => {
    if (!canSync) return

    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void synchronizeFromServer(false)
      }
    }, POLL_INTERVAL_MS)

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void synchronizeFromServer(false)
      }
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      window.clearInterval(poll)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [canSync, synchronizeFromServer])

  return {
    syncKey,
    setSyncKey,
    userRole,
    setUserRole,
    userKey,
    setUserKey,
    canSync,
    state,
    setState,
    status,
    pullFromServer,
  }
}

function normalizeState(state: unknown): AppStateV1 {
  try {
    if (!state || typeof state !== 'object') {
      return defaultState()
    }

    const raw = state as Partial<AppStateV1>
    const parsedCapacity = Number(raw.partyCarryCapacity)
    const parsedStateVersion = Number(raw.stateVersion)

    return normalizeAppStateInventory({
      version: 1,
      stateVersion:
        Number.isFinite(parsedStateVersion) && parsedStateVersion >= 0
          ? Math.trunc(parsedStateVersion)
          : 0,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
      entityVersions: normalizeEntityVersions(raw.entityVersions),
      operations: normalizeGameOperationLog(raw.operations),
      characters: Array.isArray(raw.characters) ? raw.characters : [],
      activeCharacterId:
        typeof raw.activeCharacterId === 'string'
          ? raw.activeCharacterId
          : '',
      partyInventory: Array.isArray(raw.partyInventory)
        ? raw.partyInventory
        : [],
      partyCarryCapacity:
        Number.isFinite(parsedCapacity) && parsedCapacity >= 0
          ? parsedCapacity
          : 0,
      spells: Array.isArray(raw.spells) ? raw.spells : [],
    })
  } catch {
    return defaultState()
  }
}

function normalizeEntityVersions(
  value: unknown,
): Record<string, GameEntityMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const result: Record<string, GameEntityMetadata> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const metadata = entry as GameEntityMetadata
    const parsedVersion = Number(metadata.version)
    result[key] = {
      version:
        Number.isFinite(parsedVersion) && parsedVersion >= 0
          ? Math.trunc(parsedVersion)
          : 0,
      updatedAt:
        typeof metadata.updatedAt === 'string' ? metadata.updatedAt : undefined,
      updatedBy:
        typeof metadata.updatedBy === 'string' ? metadata.updatedBy : undefined,
    }
  }

  return result
}

function statesEqual(left: AppStateV1, right: AppStateV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
