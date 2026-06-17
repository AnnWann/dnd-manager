import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readLocalStorageJson, writeLocalStorageJson } from './storage'
import type { CharacterTemplateProps } from '../models/characters/CharacterTemplate'
import type { Spell } from '../models/magic/spells/Spell'

export type AppStateV1 = {
  version: 1
  characters: CharacterTemplateProps[]
  activeCharacterId: string

  /** Optional: reusable homebrew spell definitions keyed by hb:... index (synced across devices). */
  spells?: Spell[]


}

const LOCAL_STATE_KEY = 'dndmm.appState.v1'
const SYNC_KEY_STORAGE = 'dndmm.syncKey.v1'
const USER_ROLE_STORAGE = 'dndmm.userRole.v1'
const USER_KEY_STORAGE = 'dndmm.userKey.v1'

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'synced'; at: number }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

function defaultState(): AppStateV1 {
  return {
    version: 1,
    characters: [],
    activeCharacterId: '',
    spells:[],
  }
}

function getKeyFromUrl(): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  const k = url.searchParams.get('k') ?? url.searchParams.get('key') ?? ''
  return k
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
  const stored = window.localStorage.getItem(USER_ROLE_STORAGE)
  return stored === 'master' ? 'master' : 'player'
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

async function apiGetState(syncKey: string): Promise<{ state: AppStateV1 | null }> {
  const res = await fetch(`/api/state?key=${encodeURIComponent(syncKey)}`)
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'API /api/state não encontrada (HTTP 404). Em desenvolvimento local, use "vercel dev" (Vite não executa a pasta /api). Em produção, confirme que o deploy está na Vercel e que a função /api/state existe.',
      )
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { state: AppStateV1 | null }
}

async function apiPutState(syncKey: string, state: AppStateV1): Promise<void> {
  const res = await fetch(`/api/state?key=${encodeURIComponent(syncKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'API /api/state não encontrada (HTTP 404). Em desenvolvimento local, use "vercel dev" (Vite não executa a pasta /api). Em produção, confirme que o deploy está na Vercel e que a função /api/state existe.',
      )
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
}

export function useRemoteAppState() {
  const [syncKey, setSyncKey] = useState<string>(() => readSyncKey())
  const [userRole, setUserRole] = useState<'master' | 'player'>(() => readUserRole())
  const [userKey, setUserKey] = useState<string>(() => readUserKey())
  const [state, setState] = useState<AppStateV1>(() => {
    const local = readLocalStorageJson<AppStateV1>(LOCAL_STATE_KEY)
    return normalizeState(local)
  })
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })

  const stateRef = useRef<AppStateV1>(state)

  const hydratedFromRemote = useRef(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    writeLocalStorageJson(LOCAL_STATE_KEY, state)
  }, [state])

  useEffect(() => {
    writeSyncKey(syncKey)
  }, [syncKey])

  useEffect(() => {
    writeUserRole(userRole)
  }, [userRole])

  useEffect(() => {
    writeUserKey(userKey)
  }, [userKey])

  const canSync = useMemo(() => syncKey.trim().length >= 12, [syncKey])

  const pullFromServer = useCallback(async () => {
    if (!canSync) {
      setStatus({ kind: 'error', message: 'Chave de sync inválida (mínimo 12 caracteres).' })
      return
    }
    setStatus({ kind: 'loading' })
    try {
      const data = await apiGetState(syncKey)
      hydratedFromRemote.current = true
      if (data.state) {
        setState(normalizeState(data.state))
      } else {
        // Bootstrap: if the key has no remote state yet, persist the current local state
        // so subsequent pulls work across devices without requiring an extra local change.
        await apiPutState(syncKey, normalizeState(stateRef.current))
      }
      setStatus({ kind: 'synced', at: Date.now() })
    } catch (err: unknown) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Falha ao carregar.' })
    }
  }, [canSync, syncKey])

  useEffect(() => {
    if (!canSync) return
    const t = window.setTimeout(() => {
      void pullFromServer()
    }, 0)
    return () => window.clearTimeout(t)
  }, [canSync, pullFromServer, syncKey])

  useEffect(() => {
    if (!canSync) return
    if (!hydratedFromRemote.current) return

    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setStatus({ kind: 'saving' })

    saveTimer.current = window.setTimeout(() => {
      apiPutState(syncKey, (state))
        .then(() => {
          setStatus({ kind: 'synced', at: Date.now() })
        })
        .catch((err: unknown) => {
          setStatus({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Falha ao salvar.',
          })
        })
    }, 800)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [canSync, state, syncKey])

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
    if (!state || typeof state !== "object") {
      return defaultState()
    }

    const raw = state as Partial<AppStateV1>

    return {
      version: 1,
      characters: Array.isArray(raw.characters) ? raw.characters : [],
      activeCharacterId:
        typeof raw.activeCharacterId === "string"
          ? raw.activeCharacterId
          : "",
      spells: Array.isArray(raw.spells) ? raw.spells : [],
    }
  } catch {
    return defaultState()
  }
}