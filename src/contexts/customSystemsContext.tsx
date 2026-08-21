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
import { useOptionalCreationEditor } from '../features/creation/CreationEditorProvider'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'
import { setCustomSystemDefinitions } from '../lib/customSystems'
import { readLocalStorageJson, writeLocalStorageJson } from '../lib/storage'
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
  hydrated: boolean
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

type LocalCustomSystemsSnapshot = {
  schema: 'dndmm.custom-systems-local'
  version: 1
  definitions: CustomSystemDefinition[]
  baseDefinitions: CustomSystemDefinition[]
  revision: number
  dirty: boolean
  savedAt: number
}

const CustomSystemsContext = createContext<CustomSystemsContextValue | null>(null)
const LOCAL_STATE_KEY = 'dndmm.customSystems.v1'
const SAVE_DELAY = 600
const RETRY_DELAY = 5000
const MAX_CONFLICT_RETRIES = 4

export function CustomSystemsProvider({ children }: { children: ReactNode }) {
  const { syncKey, userRole, userKey } = useSyncContext()
  const initialSnapshotRef = useRef<LocalCustomSystemsSnapshot | null>(null)
  const initialSnapshot = initialSnapshotRef.current ?? readLocalSnapshot()
  initialSnapshotRef.current = initialSnapshot

  const [definitions, setDefinitions] = useState<CustomSystemDefinition[]>(initialSnapshot.definitions)
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })
  const [hydrated, setHydrated] = useState(false)
  const definitionsRef = useRef(initialSnapshot.definitions)
  const baseDefinitionsRef = useRef(initialSnapshot.baseDefinitions)
  const revisionRef = useRef(initialSnapshot.revision)
  const dirtyRef = useRef(initialSnapshot.dirty)
  const savingRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const flushRef = useRef<() => Promise<void>>(async () => undefined)
  const syncKeyRef = useRef(syncKey)
  const clientIdRef = useRef(readClientId())
  const canSync = syncKey.trim().length >= 12
  const canManage = userRole === 'master'

  useEffect(() => {
    syncKeyRef.current = syncKey
  }, [syncKey])

  useEffect(() => {
    setCustomSystemDefinitions(definitions)
  }, [definitions])

  const saveLocalSnapshot = useCallback(() => {
    writeLocalSnapshot({
      definitions: definitionsRef.current,
      baseDefinitions: baseDefinitionsRef.current,
      revision: revisionRef.current,
      dirty: dirtyRef.current,
    })
  }, [])

  const applyLocalDefinitions = useCallback((value: unknown, dirty: boolean) => {
    const normalized = normalizeDefinitions(value)
    definitionsRef.current = normalized
    dirtyRef.current = dirty
    setDefinitions(normalized)
    writeLocalSnapshot({
      definitions: normalized,
      baseDefinitions: baseDefinitionsRef.current,
      revision: revisionRef.current,
      dirty,
    })
    return normalized
  }, [])

  const schedulePersist = useCallback((delay = SAVE_DELAY) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushRef.current()
    }, delay)
  }, [])

  const flushPersist = useCallback(async () => {
    if (!canSync || !canManage || !dirtyRef.current) return
    if (savingRef.current) return
    savingRef.current = true

    try {
      while (dirtyRef.current && syncKeyRef.current.trim().length >= 12) {
        let candidate = normalizeDefinitions(definitionsRef.current)
        let expectedRevision = revisionRef.current
        let saved = false
        setStatus({ kind: 'saving' })

        for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
          const keyAtStart = syncKeyRef.current
          const response = await fetch(`/api/custom-systems?key=${encodeURIComponent(keyAtStart)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              definitions: candidate,
              expectedRevision,
              clientId: userKey.trim() || clientIdRef.current,
            }),
          })
          const data = await response.json().catch(() => ({})) as ApiSnapshot
          if (syncKeyRef.current !== keyAtStart) return

          if (response.status === 409) {
            const remote = normalizeDefinitions(data.definitions)
            const previousBase = baseDefinitionsRef.current
            expectedRevision = Math.max(0, Math.trunc(Number(data.revision) || 0))
            revisionRef.current = expectedRevision

            let merged = mergeDefinitionSnapshots(previousBase, candidate, remote)
            merged = mergeDefinitionSnapshots(candidate, definitionsRef.current, merged)
            baseDefinitionsRef.current = remote
            candidate = applyLocalDefinitions(merged, true)
            continue
          }

          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

          revisionRef.current = Math.max(0, Math.trunc(Number(data.revision) || 0))
          baseDefinitionsRef.current = candidate
          dirtyRef.current = !definitionsEqual(definitionsRef.current, candidate)
          saveLocalSnapshot()
          saved = true

          if (!dirtyRef.current) setStatus({ kind: 'synced', at: Date.now() })
          break
        }

        if (!saved) {
          throw new Error('Muitos conflitos simultâneos. As alterações locais continuam salvas neste dispositivo.')
        }
      }
    } catch (error) {
      dirtyRef.current = true
      saveLocalSnapshot()
      setStatus({
        kind: 'error',
        message: `${error instanceof Error ? error.message : 'Falha ao sincronizar sistemas.'} Os dados locais foram preservados.`,
      })
    } finally {
      savingRef.current = false
      if (dirtyRef.current && navigator.onLine && canSync && canManage) schedulePersist(RETRY_DELAY)
    }
  }, [applyLocalDefinitions, canManage, canSync, saveLocalSnapshot, schedulePersist, userKey])

  flushRef.current = flushPersist

  const reload = useCallback(async () => {
    if (!canSync) {
      setStatus({ kind: 'idle' })
      setHydrated(true)
      saveLocalSnapshot()
      return
    }

    setStatus({ kind: 'loading' })
    try {
      const keyAtStart = syncKey
      const response = await fetch(`/api/custom-systems?key=${encodeURIComponent(keyAtStart)}`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({})) as ApiSnapshot
      if (syncKeyRef.current !== keyAtStart) return
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

      const remote = normalizeDefinitions(data.definitions)
      const local = normalizeDefinitions(definitionsRef.current)
      const remoteRevision = Math.max(0, Math.trunc(Number(data.revision) || 0))
      const remoteIsUninitialized = remoteRevision === 0 && remote.length === 0 && local.length > 0
      const hasLocalChanges = remoteIsUninitialized || dirtyRef.current || !definitionsEqual(local, baseDefinitionsRef.current)
      const next = remoteIsUninitialized
        ? local
        : hasLocalChanges
          ? mergeDefinitionSnapshots(baseDefinitionsRef.current, local, remote)
          : remote

      revisionRef.current = remoteRevision
      baseDefinitionsRef.current = remote
      const stillDirty = !definitionsEqual(next, remote)
      applyLocalDefinitions(next, stillDirty)
      setHydrated(true)

      if (stillDirty && canManage) {
        setStatus({ kind: 'saving' })
        schedulePersist(0)
      } else {
        setStatus({ kind: 'synced', at: Date.now() })
      }
    } catch (error) {
      setHydrated(true)
      setStatus({
        kind: 'error',
        message: `${error instanceof Error ? error.message : 'Falha ao carregar sistemas.'} Exibindo a cópia salva neste dispositivo.`,
      })
    }
  }, [applyLocalDefinitions, canManage, canSync, saveLocalSnapshot, schedulePersist, syncKey])

  useEffect(() => {
    setHydrated(false)
    void reload()

    const handleOnline = () => {
      if (dirtyRef.current && canManage) schedulePersist(0)
      else void reload()
    }
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveLocalSnapshot()
    }
  }, [canManage, reload, saveLocalSnapshot, schedulePersist, syncKey])

  const update = useCallback((updater: (current: CustomSystemDefinition[]) => CustomSystemDefinition[]) => {
    if (!canManage) return
    const next = normalizeDefinitions(updater(definitionsRef.current))
    applyLocalDefinitions(next, true)
    if (canSync) schedulePersist()
    else setStatus({ kind: 'idle' })
  }, [applyLocalDefinitions, canManage, canSync, schedulePersist])

  const value = useMemo<CustomSystemsContextValue>(() => ({
    definitions,
    status,
    hydrated,
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
      const source = definitionsRef.current.find((entry) => entry.id === systemId)
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
  }), [canManage, definitions, hydrated, reload, status, update])

  return <CustomSystemsContext.Provider value={value}>{children}</CustomSystemsContext.Provider>
}

export function useCustomSystemsContext(): CustomSystemsContextValue {
  const context = useContext(CustomSystemsContext)
  const editor = useOptionalCreationEditor()
  const legacySeededRef = useRef(false)

  useEffect(() => {
    if (legacySeededRef.current) return
    if (!context?.hydrated || !editor?.draft || !editor.base) return

    if (editor.managedDomains.customSystems) {
      legacySeededRef.current = true
      return
    }

    if (
      editor.base.customSystems.length > 0 ||
      editor.draft.customSystems.length > 0
    ) {
      legacySeededRef.current = true
      return
    }

    const legacyDefinitions = normalizeDefinitions(context.definitions)
    if (!legacyDefinitions.length) return

    legacySeededRef.current = true
    editor.updateDraft((draft) => ({
      ...draft,
      customSystems: legacyDefinitions.map((definition) =>
        structuredClone(definition),
      ),
    }))
  }, [context, editor])

  return useMemo(() => {
    if (!context) {
      throw new Error('useCustomSystemsContext must be used inside CustomSystemsProvider.')
    }
    if (!editor?.draft) return context

    const updateCreationDefinitions = (
      updater: (current: CustomSystemDefinition[]) => CustomSystemDefinition[],
    ) => {
      if (!context.canManage) return
      editor.updateDraft((draft) => ({
        ...draft,
        customSystems: normalizeDefinitions(updater(draft.customSystems)),
      }))
    }

    return {
      definitions: normalizeDefinitions(editor.draft.customSystems),
      status: editor.saving
        ? { kind: 'saving' as const }
        : { kind: 'idle' as const },
      hydrated: true,
      canManage: context.canManage,
      createDefinition: () => {
        const definition = createEmptyDefinition()
        updateCreationDefinitions((current) => [...current, definition])
        return definition
      },
      saveDefinition: (definition, previousId) => {
        updateCreationDefinitions((current) => {
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
        updateCreationDefinitions((current) => {
          const merged = new Map(current.map((definition) => [definition.id, definition]))
          for (const definition of incoming) merged.set(definition.id, definition)
          return [...merged.values()]
        })
      },
      removeDefinition: (systemId) => {
        updateCreationDefinitions((current) => current.filter((entry) => entry.id !== systemId))
      },
      duplicateDefinition: (systemId) => {
        const source = editor.draft?.customSystems.find((entry) => entry.id === systemId)
        if (!source) return undefined
        const copy: CustomSystemDefinition = {
          ...structuredClone(source),
          id: `${source.id}-copy-${Date.now().toString(36)}`,
          name: `${source.name} (cópia)`,
          version: 1,
        }
        updateCreationDefinitions((current) => [...current, copy])
        return copy
      },
      reload: editor.reload,
    }
  }, [context, editor])
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
    nativeStatOverrides: [],
    actions: [],
    standardActionOverrides: [],
    hiddenFromSheet: false,
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
      nativeStatOverrides: Array.isArray(raw.nativeStatOverrides) ? raw.nativeStatOverrides : [],
      actions: Array.isArray(raw.actions) ? raw.actions : [],
      standardActionOverrides: Array.isArray(raw.standardActionOverrides) ? raw.standardActionOverrides : [],
      hiddenFromSheet: raw.hiddenFromSheet === true,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      automaticInstallation: raw.automaticInstallation,
      characterPlacement: raw.characterPlacement,
      presentation: raw.presentation,
    })
  }
  return Array.from(result.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function mergeDefinitionSnapshots(
  base: CustomSystemDefinition[],
  local: CustomSystemDefinition[],
  remote: CustomSystemDefinition[],
): CustomSystemDefinition[] {
  const baseMap = new Map(normalizeDefinitions(base).map((definition) => [definition.id, definition]))
  const localMap = new Map(normalizeDefinitions(local).map((definition) => [definition.id, definition]))
  const remoteMap = new Map(normalizeDefinitions(remote).map((definition) => [definition.id, definition]))
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()])
  const merged: CustomSystemDefinition[] = []

  for (const id of ids) {
    const baseDefinition = baseMap.get(id)
    const localDefinition = localMap.get(id)
    const remoteDefinition = remoteMap.get(id)
    const localChanged = !definitionEqual(localDefinition, baseDefinition)

    if (localChanged) {
      if (localDefinition) merged.push(localDefinition)
    } else if (remoteDefinition) {
      merged.push(remoteDefinition)
    }
  }

  return normalizeDefinitions(merged)
}

function definitionEqual(left: CustomSystemDefinition | undefined, right: CustomSystemDefinition | undefined): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function definitionsEqual(left: CustomSystemDefinition[], right: CustomSystemDefinition[]): boolean {
  return JSON.stringify(normalizeDefinitions(left)) === JSON.stringify(normalizeDefinitions(right))
}

function readLocalSnapshot(): LocalCustomSystemsSnapshot {
  const stored = readLocalStorageJson<LocalCustomSystemsSnapshot | CustomSystemDefinition[]>(LOCAL_STATE_KEY)

  if (Array.isArray(stored)) {
    const definitions = normalizeDefinitions(stored)
    return {
      schema: 'dndmm.custom-systems-local',
      version: 1,
      definitions,
      baseDefinitions: [],
      revision: 0,
      dirty: definitions.length > 0,
      savedAt: Date.now(),
    }
  }

  if (stored?.schema === 'dndmm.custom-systems-local' && stored.version === 1) {
    return {
      schema: 'dndmm.custom-systems-local',
      version: 1,
      definitions: normalizeDefinitions(stored.definitions),
      baseDefinitions: normalizeDefinitions(stored.baseDefinitions),
      revision: Math.max(0, Math.trunc(Number(stored.revision) || 0)),
      dirty: Boolean(stored.dirty),
      savedAt: Number.isFinite(stored.savedAt) ? stored.savedAt : Date.now(),
    }
  }

  return {
    schema: 'dndmm.custom-systems-local',
    version: 1,
    definitions: [],
    baseDefinitions: [],
    revision: 0,
    dirty: false,
    savedAt: Date.now(),
  }
}

function writeLocalSnapshot(snapshot: Pick<LocalCustomSystemsSnapshot, 'definitions' | 'baseDefinitions' | 'revision' | 'dirty'>): void {
  writeLocalStorageJson(LOCAL_STATE_KEY, {
    schema: 'dndmm.custom-systems-local',
    version: 1,
    definitions: normalizeDefinitions(snapshot.definitions),
    baseDefinitions: normalizeDefinitions(snapshot.baseDefinitions),
    revision: Math.max(0, Math.trunc(Number(snapshot.revision) || 0)),
    dirty: Boolean(snapshot.dirty),
    savedAt: Date.now(),
  } satisfies LocalCustomSystemsSnapshot)
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
