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
  saveDefinition: (definition: CustomSystemDefinition, previousId?: string) => void
  saveDefinitions: (definitions: CustomSystemDefinition[]) => void
  removeDefinition: (systemId: string) => void
  duplicateDefinition: (systemId: string) => CustomSystemDefinition | undefined
  reload: () => Promise<void>
}

type ApiSnapshot = {
  error?: string
  definitions?: CustomSystemDefinition[]
  revision?: number
}

const CustomSystemsContext = createContext<CustomSystemsContextValue | null>(null)
const SAVE_DELAY = 600
const MAX_CONFLICT_RETRIES = 4

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

  const persist = useCallback(async (requestedDefinitions: CustomSystemDefinition[]) => {
    if (!canSync || !canManage) return
    setStatus({ kind: 'saving' })

    let candidate = normalizeDefinitions(requestedDefinitions)
    let expectedRevision = revisionRef.current

    for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
      const response = await fetch(`/api/custom-systems?key=${encodeURIComponent(syncKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitions: candidate,
          expectedRevision,
          clientId: userKey.trim() || clientIdRef.current,
        }),
      })
      const data = await response.json().catch(() => ({})) as ApiSnapshot

      if (response.status === 409) {
        const remote = normalizeDefinitions(data.definitions)
        expectedRevision = Math.max(0, Math.trunc(Number(data.revision) || 0))
        revisionRef.current = expectedRevision
        candidate = mergeDefinitions(remote, candidate)
        setDefinitions(candidate)
        continue
      }

      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      revisionRef.current = Math.max(0, Math.trunc(Number(data.revision) || 0))
      setDefinitions(candidate)
      setStatus({ kind: 'synced', at: Date.now() })
      return
    }

    throw new Error('Muitos conflitos simultâneos. As alterações locais foram preservadas; tente salvar novamente.')
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
      const data = await response.json().catch(() => ({})) as ApiSnapshot
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
    saveDefinition: (definition, previousId) => {
      update((current) => {
        const withoutPrevious = previousId && previousId !== definition.id
          ? current.filter((entry) => entry.id !== previousId)
          : current
        const exists = withoutPrevious.some((entry) => entry.id === definition.id)
        return exists
          ? withoutPrevious.map((entry) => entry.id === definition.id ? definition : entry)
          : [...withoutPrevious, definition]
      })
    },
    saveDefinitions: (incoming) => {
      update((current) => {
        const merged = new Map(current.map((definition) => [definition.id, definition]))
        for (const definition of incoming) merged.set(definition.id, definition)
        return [...merged.values()]
      })
    },
    removeDefinition: (systemId) => {
      update((current) => current.filter((entry) => entry.id !== systemId))
    },
    duplicateDefinition: (systemId) => {
      const source = definitions.find((entry) => entry.id === systemId)
      if (!source) return undefined
      const copy: CustomSystemDefinition = {
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
  return {
    id: `system-${crypto.randomUUID()}`,
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
      automaticInstallation: raw.automaticInstallation,
    })
  }
  return Array.from(result.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function mergeDefinitions(remote: CustomSystemDefinition[], local: CustomSystemDefinition[]): CustomSystemDefinition[] {
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
