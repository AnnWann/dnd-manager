import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  normalizeGameOperationLog,
  type GameEntityMetadata,
} from '../models/game/GameOperation'
import type { Mission } from '../models/missions/Mission'
import { normalizeMissions } from '../models/missions/Mission'
import { normalizeAppStateInventory } from './normalizeAppStateInventory'
import {
  readSyncKey,
  readUserKey,
  readUserRole,
  writeSyncKey,
  writeUserKey,
  writeUserRole,
  type AppStateV1,
  type SyncStatus,
} from './remoteState'
import { readLocalStorageJson, writeLocalStorageJson } from './storage'
import { mergeAppStates } from './stateMerge'

export type ConcurrentAppState = AppStateV1 & {
  missions?: Mission[]
}

const LOCAL_STATE_KEY = 'dndmm.appState.v1'
const LOCAL_SESSION_PREFIX = 'dndmm.appState.session.v1:'
const CLIENT_ID_STORAGE = 'dndmm.clientId.v1'
const SAVE_DELAY_MS = 800
const POLL_INTERVAL_MS = 5000
const MAX_CONFLICT_RETRIES = 5

type RemoteSnapshot = {
  state: ConcurrentAppState | null
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

function defaultState(): ConcurrentAppState {
  return {
    version: 1,
    stateVersion: 0,
    characters: [],
    activeCharacterId: '',
    partyInventory: [],
    groundInventory: [],
    partyCarryCapacity: 0,
    spells: [],
    missions: [],
    entityVersions: {},
    operations: [],
  }
}

function localSessionKey(syncKey: string): string {
  return `${LOCAL_SESSION_PREFIX}${encodeURIComponent(syncKey.trim())}`
}

function readInitialLocalState(syncKey: string): ConcurrentAppState {
  if (syncKey.trim().length >= 12) {
    const scoped = readLocalStorageJson<ConcurrentAppState>(localSessionKey(syncKey))
    if (scoped) return normalizeState(scoped)
  }
  return normalizeState(readLocalStorageJson<ConcurrentAppState>(LOCAL_STATE_KEY))
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
  const response = await fetch(`/api/state?key=${encodeURIComponent(syncKey)}`, { cache: 'no-store' })
  if (!response.ok) {
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

async function apiPutState(syncKey: string, state: ConcurrentAppState, expectedRevision: number, clientId: string): Promise<SaveResponse> {
  const response = await fetch(`/api/state?key=${encodeURIComponent(syncKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, expectedRevision, clientId }),
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    state?: ConcurrentAppState | null
    revision?: number
    updatedAt?: string | null
    updatedBy?: string | null
  }
  if (response.status === 409) {
    throw new SyncConflictError({
      state: data.state ? normalizeState(data.state) : null,
      revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
    })
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return {
    ok: true,
    revision: Math.max(0, Math.trunc(Number(data.revision) || 0)),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

export function useConcurrentRemoteAppState() {
  const [syncKey, setSyncKey] = useState<string>(() => readSyncKey())
  const [userRole, setUserRole] = useState<'master' | 'player'>(() => readUserRole())
  const [userKey, setUserKey] = useState<string>(() => readUserKey())
  const [clientId] = useState(() => readClientId())
  const [state, setState] = useState<ConcurrentAppState>(() => readInitialLocalState(readSyncKey()))
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })

  const stateRef = useRef(state)
  const baseStateRef = useRef(state)
  const revisionRef = useRef(0)
  const hydratedRef = useRef(false)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const pollingRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const flushRef = useRef<() => Promise<void>>(async () => undefined)
  const syncKeyRef = useRef(syncKey)
  const activeSessionRef = useRef(syncKey)

  useEffect(() => {
    stateRef.current = state
    writeLocalStorageJson(LOCAL_STATE_KEY, state)
    const key = syncKeyRef.current.trim()
    if (key.length >= 12) writeLocalStorageJson(localSessionKey(key), state)
  }, [state])

  useEffect(() => {
    syncKeyRef.current = syncKey
    writeSyncKey(syncKey)
  }, [syncKey])

  useEffect(() => writeUserRole(userRole), [userRole])
  useEffect(() => writeUserKey(userKey), [userKey])

  const canSync = useMemo(() => syncKey.trim().length >= 12, [syncKey])

  const scheduleSave = useCallback((delay = SAVE_DELAY_MS) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => void flushRef.current(), delay)
  }, [])

  const flushSave = useCallback(async () => {
    if (!canSync || !hydratedRef.current) return
    if (savingRef.current) { dirtyRef.current = true; return }
    savingRef.current = true
    try {
      while (dirtyRef.current) {
        dirtyRef.current = false
        let candidate = normalizeState(stateRef.current)
        let base = baseStateRef.current
        let expectedRevision = revisionRef.current
        if (sharedStatesEqual(candidate, base)) continue
        setStatus({ kind: 'saving' })
        let saved = false
        for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
          const keyAtStart = syncKeyRef.current
          try {
            const response = await apiPutState(keyAtStart, candidate, expectedRevision, clientId)
            if (syncKeyRef.current !== keyAtStart) return
            revisionRef.current = response.revision
            baseStateRef.current = candidate
            saved = true
            setStatus({ kind: 'synced', at: Date.now() })
            break
          } catch (error) {
            if (!(error instanceof SyncConflictError)) throw error
            const remote = normalizeState(error.snapshot.state ?? defaultState())
            const localSnapshot = candidate
            const mergedSnapshot = mergeAppStates(base, localSnapshot, remote) as ConcurrentAppState
            const latestLocal = normalizeState(stateRef.current)
            candidate = mergeAppStates(localSnapshot, latestLocal, mergedSnapshot) as ConcurrentAppState
            base = remote
            expectedRevision = error.snapshot.revision
            baseStateRef.current = remote
            revisionRef.current = expectedRevision
            stateRef.current = candidate
            setState(candidate)
          }
        }
        if (!saved) throw new Error('Muitas alterações simultâneas. O estado local foi preservado; tente sincronizar novamente.')
        if (!sharedStatesEqual(stateRef.current, candidate)) dirtyRef.current = true
      }
    } catch (error) {
      dirtyRef.current = true
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Falha ao salvar.' })
    } finally {
      savingRef.current = false
      if (dirtyRef.current) scheduleSave(1200)
    }
  }, [canSync, clientId, scheduleSave])

  flushRef.current = flushSave

  useEffect(() => {
    if (!canSync || !hydratedRef.current) return
    if (sharedStatesEqual(state, baseStateRef.current)) return
    dirtyRef.current = true
    scheduleSave()
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current) }
  }, [canSync, scheduleSave, state, syncKey])

  const synchronizeFromServer = useCallback(async (showLoading: boolean) => {
    if (!canSync) {
      if (showLoading) setStatus({ kind: 'error', message: 'Chave de sync inválida (mínimo 12 caracteres).' })
      return
    }
    if (pollingRef.current) return
    pollingRef.current = true
    if (showLoading) setStatus({ kind: 'loading' })
    try {
      const keyAtStart = syncKey
      const snapshot = await apiGetState(keyAtStart)
      if (syncKeyRef.current !== keyAtStart) return
      if (hydratedRef.current && snapshot.revision < revisionRef.current) return
      if (hydratedRef.current && snapshot.revision === revisionRef.current && snapshot.state) {
        if (showLoading) setStatus({ kind: 'synced', at: Date.now() })
        return
      }
      const local = normalizeState(stateRef.current)
      const previousBase = baseStateRef.current
      if (!snapshot.state) {
        hydratedRef.current = true
        revisionRef.current = 0
        baseStateRef.current = defaultState()
        if (!sharedStatesEqual(local, defaultState())) {
          dirtyRef.current = true
          scheduleSave(0)
          if (showLoading) setStatus({ kind: 'saving' })
        } else {
          setStatus({ kind: 'synced', at: Date.now() })
        }
        return
      }
      const remote = normalizeState(snapshot.state)
      const hasLocalChanges = hydratedRef.current && !sharedStatesEqual(local, previousBase)
      const next: ConcurrentAppState = hasLocalChanges
        ? (mergeAppStates(previousBase, local, remote) as ConcurrentAppState)
        : { ...remote, activeCharacterId: local.activeCharacterId }
      hydratedRef.current = true
      revisionRef.current = snapshot.revision
      baseStateRef.current = remote
      stateRef.current = next
      setState(next)
      if (!sharedStatesEqual(next, remote)) {
        dirtyRef.current = true
        scheduleSave(0)
      } else setStatus({ kind: 'synced', at: Date.now() })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Falha ao carregar.' })
    } finally {
      pollingRef.current = false
    }
  }, [canSync, scheduleSave, syncKey])

  const pullFromServer = useCallback(async () => synchronizeFromServer(true), [synchronizeFromServer])

  useEffect(() => {
    if (activeSessionRef.current !== syncKey) {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      const scoped = syncKey.trim().length >= 12
        ? readLocalStorageJson<ConcurrentAppState>(localSessionKey(syncKey))
        : null
      const next = normalizeState(scoped ?? defaultState())
      activeSessionRef.current = syncKey
      stateRef.current = next
      baseStateRef.current = next
      setState(next)
    }
    hydratedRef.current = false
    revisionRef.current = 0
    dirtyRef.current = false
    if (!canSync) return
    const timer = window.setTimeout(() => void synchronizeFromServer(true), 0)
    return () => window.clearTimeout(timer)
  }, [canSync, syncKey, synchronizeFromServer])

  useEffect(() => {
    if (!canSync) return
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void synchronizeFromServer(false)
    }, POLL_INTERVAL_MS)
    const refresh = () => {
      if (document.visibilityState === 'visible') void synchronizeFromServer(false)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [canSync, synchronizeFromServer])

  const exportState = useCallback((): ConcurrentAppState => structuredClone(normalizeState(stateRef.current)), [])
  const importState = useCallback((value: unknown) => {
    const next = normalizeState(value)
    stateRef.current = next
    setState(next)
    dirtyRef.current = true
    if (canSync && hydratedRef.current) scheduleSave(0)
  }, [canSync, scheduleSave])

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
    exportState,
    importState,
  }
}

function normalizeState(state: unknown): ConcurrentAppState {
  try {
    if (!state || typeof state !== 'object') return defaultState()
    const raw = state as Partial<ConcurrentAppState>
    const parsedCapacity = Number(raw.partyCarryCapacity)
    const parsedStateVersion = Number(raw.stateVersion)
    return normalizeAppStateInventory({
      version: 1,
      stateVersion: Number.isFinite(parsedStateVersion) && parsedStateVersion >= 0 ? Math.trunc(parsedStateVersion) : 0,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
      entityVersions: normalizeEntityVersions(raw.entityVersions),
      operations: normalizeGameOperationLog(raw.operations),
      characters: Array.isArray(raw.characters) ? raw.characters : [],
      activeCharacterId: typeof raw.activeCharacterId === 'string' ? raw.activeCharacterId : '',
      partyInventory: Array.isArray(raw.partyInventory) ? raw.partyInventory : [],
      groundInventory: Array.isArray(raw.groundInventory) ? raw.groundInventory : [],
      partyCarryCapacity: Number.isFinite(parsedCapacity) && parsedCapacity >= 0 ? parsedCapacity : 0,
      spells: Array.isArray(raw.spells) ? raw.spells : [],
      missions: normalizeMissions(raw.missions),
    } as ConcurrentAppState)
  } catch { return defaultState() }
}

function normalizeEntityVersions(value: unknown): Record<string, GameEntityMetadata> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, GameEntityMetadata> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const metadata = entry as GameEntityMetadata
    const parsedVersion = Number(metadata.version)
    result[key] = {
      version: Number.isFinite(parsedVersion) && parsedVersion >= 0 ? Math.trunc(parsedVersion) : 0,
      updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : undefined,
      updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : undefined,
    }
  }
  return result
}

function sharedStatesEqual(left: ConcurrentAppState, right: ConcurrentAppState): boolean {
  return JSON.stringify(withoutLocalPreferences(left)) === JSON.stringify(withoutLocalPreferences(right))
}

function withoutLocalPreferences(state: ConcurrentAppState): ConcurrentAppState {
  return { ...state, activeCharacterId: '' }
}
