import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'
import { setCustomSystemDefinitions } from '../lib/customSystems'
import { useSyncContext } from './syncContext'

type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'saving' }
  | { kind: 'synced'; at: number }
  | { kind: 'error'; message: string }

type CustomSystemsContextValue = {
  definitions: CustomSystemDefinition[]
  status: SyncStatus
  canManage: boolean
  createDefinition: () => CustomSystemDefinition
  saveDefinition: (definition: CustomSystemDefinition) => void
  removeDefinition: (systemId: string) => void
  duplicateDefinition: (systemId: string) => CustomSystemDefinition | undefined
  reload: () => Promise<void>
}

const CustomSystemsContext = createContext<CustomSystemsContextValue | null>(null)
const SAVE_DELAY = 600

export function CustomSystemsProvider({ children }: { children: ReactNode }) {
  const { syncKey, userRole, userKey } = useSyncContext()
  const [definitions, setDefinitions] = useState<CustomSystemDefinition[]>([])
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })
  const revisionRef = useRef(0)
  const saveTimerRef = useRef<number | null>(null)
  const clientIdRef = useRef(readClientId())
  const canSync = syncKey.trim().length >= 12
  const canManage = userRole === 'master'

  useEffect(() => {
    setCustomSystemDefinitions(definitions)
  }, [definitions])

  const persist = useCallback(async (nextDefinitions: CustomSystemDefinition[]) => {
    if (!canSync || !canManage) return
    setStatus({ kind: 'saving' })

    const response = await fetch(`/api/custom-systems?key=${encodeURIComponent(syncKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definitions: nextDefinitions,
        expectedRevision: revisionRef.current,
        clientId: userKey.trim() || clientIdRef.current,
      }),
    })
    const data = await response.json().catch(() => ({})) as {
      error?: string
      definitions?: CustomSystemDefinition[]
      revision?: number
    }

    if (response.status === 409) {
      const remote = normalizeDefinitions(data.definitions)
      revisionRef.current = Math.max(0, Math.trunc(Number(data.revision) || 0))
      const merged = mergeDefinitions(remote, nextDefinitions)
      setDefinitions(merged)
      await persist(merged)
      return
    }

    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
    revisionRef.current = Math.max(0, Math.trunc(Number(data.revision) || 0))
    setStatus({ kind: 'synced', at: Date.now() })
  }, [canManage, canSync, syncKey, userKey])

  const schedulePersist = useCallback((nextDefinitions: CustomSystemDefinition[]) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void persist(nextDefinitions).catch((error) => {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Falha ao salvar sistemas.',
        })
      })
    }, SAVE_DELAY)
  }, [persist])

  const reload = useCallback(async () => {
    if (!canSync) {
      setDefinitions([])
      revisionRef.current = 0
      setStatus({ kind: 'idle' })
      return
    }

    setStatus({ kind: 'loading' })
    try {
      const response = await fetch(`/api/custom-systems?key=${encodeURIComponent(syncKey)}`, {
        cache: 'no-store',
      })
      const data = await response.json() as {
        error?: string
        definitions?: CustomSystemDefinition[]
        revision?: number
      }
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      const normalized = normalizeDefinitions(data.definitions)
      revisionRef.current = Math.max(0, Math.trunc(Number(data.revision) || 0))
      setDefinitions(normalized)
      setStatus({ kind: 'synced', at: Date.now() })
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Falha ao carregar sistemas.',
      })
    }
  }, [canSync, syncKey])

  useEffect(() => {
    void reload()
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [reload])

  const update = useCallback((updater: (current: CustomSystemDefinition[]) => CustomSystemDefinition[]) => {
    if (!canManage) return
    setDefinitions((current) => {
      const next = normalizeDefinitions(updater(current))
      schedulePersist(next)
      return next
    })
  }, [canManage, schedulePersist])

  const value = useMemo<CustomSystemsContextValue>(() => ({
    definitions,
    status,
    canManage,
    createDefinition: () => {
      const definition = createEmptyDefinition()
      update((current) => [...current, definition])
      return definition
    },
    saveDefinition: (definition) => {
      update((current) => {
        const index = current.findIndex((entry) => entry.id === definition.id)
        if (index < 0) return [...current, definition]
        return current.map((entry, entryIndex) => entryIndex === index ? definition : entry)
      })
    },
    removeDefinition: (systemId) => {
      update((current) => current.filter((entry) => entry.id !== systemId))
    },
    duplicateDefinition: (systemId) => {
      const source = definitions.find((entry) => entry.id === systemId)
      if (!source) return undefined
      const copy = {
        ...structuredClone(source),
        id: `${source.id}-copy-${Date.now().toString(36)}`,
        name: `${source.name} (cópia)`,
        version: 1,
      }
      update((current) => [...current, copy])
      return copy
    },
    reload,
  }), [canManage, definitions, reload, update])

  return <CustomSystemsContext.Provider value={value}>{children}</CustomSystemsContext.Provider>
}

export function useCustomSystemsContext(): CustomSystemsContextValue {
  const context = useContext(CustomSystemsContext)
  if (!context) throw new Error('useCustomSystemsContext must be used inside CustomSystemsProvider.')
  return context
}

function createEmptyDefinition(): CustomSystemDefinition {
  const id = `system-${crypto.randomUUID()}`
  return {
    id,
    name: 'Novo sistema',
    description: '',
    version: 1,
    fields: [],
    resources: [],
    abilityTypes: [],
    panels: [],
    automations: [],
    tags: [],
  }
}

function normalizeDefinitions(value: unknown): CustomSystemDefinition[] {
  if (!Array.isArray(value)) return []
  const result = new Map<string, CustomSystemDefinition>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const raw = entry as Partial<CustomSystemDefinition>
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    if (!id) continue
    result.set(id, {
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      icon: typeof raw.icon === 'string' ? raw.icon : undefined,
      version: Number.isFinite(Number(raw.version)) ? Math.max(1, Math.trunc(Number(raw.version))) : 1,
      fields: Array.isArray(raw.fields) ? raw.fields : [],
      resources: Array.isArray(raw.resources) ? raw.resources : [],
      abilityTypes: Array.isArray(raw.abilityTypes) ? raw.abilityTypes : [],
      panels: Array.isArray(raw.panels) ? raw.panels : [],
      automations: Array.isArray(raw.automations) ? raw.automations : [],
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    })
  }
  return Array.from(result.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function mergeDefinitions(
  remote: CustomSystemDefinition[],
  local: CustomSystemDefinition[],
): CustomSystemDefinition[] {
  const merged = new Map(remote.map((definition) => [definition.id, definition]))
  for (const definition of local) merged.set(definition.id, definition)
  return normalizeDefinitions(Array.from(merged.values()))
}

function readClientId(): string {
  if (typeof window === 'undefined') return 'server-render'
  const key = 'dndmm.customSystemsClientId.v1'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(key, created)
  return created
}
