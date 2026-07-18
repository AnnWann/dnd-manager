import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { AppStateV1, SyncStatus } from '../lib/remoteState'
import { setCustomSystemDefinitions } from '../lib/customSystems'
import { readLocalStorageJson, writeLocalStorageJson } from '../lib/storage'
import type { CustomSystemDefinition } from '../models/customSystems/CustomSystemDefinition'
import { useSyncContext } from './syncContext'

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

type Props = {
  children: ReactNode
  appState: AppStateV1
  setAppState: Dispatch<SetStateAction<AppStateV1>>
}

type LegacyLocalSnapshot = {
  schema?: string
  version?: number
  definitions?: CustomSystemDefinition[]
}

const CustomSystemsContext = createContext<CustomSystemsContextValue | null>(null)
const LEGACY_LOCAL_STATE_KEY = 'dndmm.customSystems.v1'

export function CustomSystemsProvider({ children, appState, setAppState }: Props) {
  const { userRole, syncStatus, pullFromServer } = useSyncContext()
  const canManage = userRole === 'master'
  const definitions = useMemo(
    () => normalizeDefinitions(appState.customSystemDefinitions),
    [appState.customSystemDefinitions],
  )
  const migratedRef = useRef(false)

  useEffect(() => {
    setCustomSystemDefinitions(definitions)
    writeLocalStorageJson(LEGACY_LOCAL_STATE_KEY, definitions)
  }, [definitions])

  useEffect(() => {
    if (migratedRef.current || !canManage || definitions.length > 0) return
    migratedRef.current = true

    const legacy = readLocalStorageJson<LegacyLocalSnapshot | CustomSystemDefinition[]>(
      LEGACY_LOCAL_STATE_KEY,
    )
    const localDefinitions = normalizeDefinitions(
      Array.isArray(legacy) ? legacy : legacy?.definitions,
    )
    if (!localDefinitions.length) return

    setAppState((current) => ({
      ...current,
      customSystemDefinitions: localDefinitions,
    }))
  }, [canManage, definitions.length, setAppState])

  const update = useCallback(
    (updater: (current: CustomSystemDefinition[]) => CustomSystemDefinition[]) => {
      if (!canManage) return
      setAppState((current) => ({
        ...current,
        customSystemDefinitions: normalizeDefinitions(
          updater(normalizeDefinitions(current.customSystemDefinitions)),
        ),
      }))
    },
    [canManage, setAppState],
  )

  const value = useMemo<CustomSystemsContextValue>(() => ({
    definitions,
    status: syncStatus,
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
    reload: async () => {
      await pullFromServer()
    },
  }), [canManage, definitions, pullFromServer, syncStatus, update])

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
      ...raw,
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
      version: Number.isFinite(Number(raw.version))
        ? Math.max(1, Math.trunc(Number(raw.version)))
        : 1,
      fields: Array.isArray(raw.fields) ? raw.fields : [],
      resources: Array.isArray(raw.resources) ? raw.resources : [],
      abilityTypes: Array.isArray(raw.abilityTypes) ? raw.abilityTypes : [],
      panels: Array.isArray(raw.panels) ? raw.panels : [],
      automations: Array.isArray(raw.automations) ? raw.automations : [],
      tags: Array.isArray(raw.tags)
        ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
    } as CustomSystemDefinition)
  }

  return Array.from(result.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  )
}
