import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  getCreationSnapshot,
  saveCreationSnapshot,
} from "../../api/creation"
import { getApiStatus } from "../../api/api-client"
import type {
  CreationSnapshot,
  CreationState,
} from "../../shared/creation/creation.types"

type CreationEditorStatus = "loading" | "ready" | "error"

type CreationEditorContextValue = {
  campaignId: string
  status: CreationEditorStatus
  error: string
  base: CreationState | null
  draft: CreationState | null
  baseRevision: number | null
  updatedAt: string | null
  dirty: boolean
  saving: boolean
  updateDraft: (updater: (draft: CreationState) => CreationState) => void
  save: () => Promise<void>
  cancel: () => void
  reload: () => Promise<void>
}

const CreationEditorContext = createContext<CreationEditorContextValue | null>(null)

export function CreationEditorProvider({
  campaignId,
  children,
}: {
  campaignId: string
  children: ReactNode
}) {
  const [status, setStatus] = useState<CreationEditorStatus>("loading")
  const [error, setError] = useState("")
  const [base, setBase] = useState<CreationState | null>(null)
  const [draft, setDraft] = useState<CreationState | null>(null)
  const [baseRevision, setBaseRevision] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const applySnapshot = useCallback((snapshot: CreationSnapshot) => {
    const canonical = structuredClone(snapshot.data)
    setBase(canonical)
    setDraft(structuredClone(canonical))
    setBaseRevision(snapshot.revision)
    setUpdatedAt(snapshot.updatedAt)
    setError("")
    setStatus("ready")
  }, [])

  const reload = useCallback(async () => {
    setStatus("loading")
    setError("")
    try {
      applySnapshot(await getCreationSnapshot(campaignId))
    } catch (cause) {
      setStatus("error")
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o estado de Criação.",
      )
    }
  }, [applySnapshot, campaignId])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateDraft = useCallback(
    (updater: (current: CreationState) => CreationState) => {
      setDraft((current) => {
        if (!current) return current
        const editable = structuredClone(current)
        return structuredClone(updater(editable))
      })
      setError("")
    },
    [],
  )

  const cancel = useCallback(() => {
    if (!base || saving) return
    setDraft(structuredClone(base))
    setError("")
  }, [base, saving])

  const dirty = useMemo(
    () => Boolean(base && draft && !creationStatesEqual(base, draft)),
    [base, draft],
  )

  useEffect(() => {
    if (!dirty) return

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])

  const save = useCallback(async () => {
    if (!dirty || !draft || baseRevision === null || saving) return

    setSaving(true)
    setError("")
    try {
      const snapshot = await saveCreationSnapshot(
        campaignId,
        baseRevision,
        draft,
      )
      applySnapshot(snapshot)
    } catch (cause) {
      if (getApiStatus(cause) === 409) {
        setError(
          "A Criação foi alterada em outra janela ou por outro mestre. Recarregue antes de salvar novamente.",
        )
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível salvar as alterações de Criação.",
        )
      }
      throw cause
    } finally {
      setSaving(false)
    }
  }, [
    applySnapshot,
    baseRevision,
    campaignId,
    dirty,
    draft,
    saving,
  ])

  const value = useMemo<CreationEditorContextValue>(
    () => ({
      campaignId,
      status,
      error,
      base,
      draft,
      baseRevision,
      updatedAt,
      dirty,
      saving,
      updateDraft,
      save,
      cancel,
      reload,
    }),
    [
      base,
      baseRevision,
      campaignId,
      cancel,
      dirty,
      draft,
      error,
      reload,
      save,
      saving,
      status,
      updateDraft,
      updatedAt,
    ],
  )

  return (
    <CreationEditorContext.Provider value={value}>
      {children}
    </CreationEditorContext.Provider>
  )
}

export function useCreationEditor() {
  const context = useContext(CreationEditorContext)
  if (!context) {
    throw new Error(
      "useCreationEditor must be used inside CreationEditorProvider",
    )
  }
  return context
}

export function useOptionalCreationEditor() {
  return useContext(CreationEditorContext)
}

function creationStatesEqual(left: CreationState, right: CreationState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
