import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getCreationSnapshot } from "../../api/creation"
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
  resetDraft: () => void
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
      setDraft((current) => current ? structuredClone(updater(current)) : current)
    },
    [],
  )

  const resetDraft = useCallback(() => {
    if (!base) return
    setDraft(structuredClone(base))
  }, [base])

  const dirty = useMemo(
    () => Boolean(base && draft && !creationStatesEqual(base, draft)),
    [base, draft],
  )

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
      // PATCH persistence is introduced in a later step. Keeping the flag in
      // the editor contract now avoids changing every consumer when Save lands.
      saving: false,
      updateDraft,
      resetDraft,
      reload,
    }),
    [
      base,
      baseRevision,
      campaignId,
      dirty,
      draft,
      error,
      reload,
      resetDraft,
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
