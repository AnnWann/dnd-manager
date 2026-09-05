import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useBlocker } from "react-router-dom"

import {
  getCreationSnapshot,
  saveCreationSnapshot,
} from "../../api/creation"
import { getApiStatus } from "../../api/api-client"
import { getSessionCreationSettings } from "../../api/session-settings"
import { setCreationCustomSystemOverride } from "../../lib/customSystems/creationCustomSystemsBridge"
import {
  toSessionRuntimeConfig,
} from "../../shared/session-runtime/sessionRuntimeConfig"
import type {
  CreationCharacterConfiguration,
  CreationManagedDomains,
  CreationSnapshot,
  CreationState,
} from "../../shared/creation/creation.types"
import { useOptionalSessionRuntime } from "../session-runtime/SessionRuntimeProvider"

type CreationEditorStatus = "loading" | "ready" | "error"

const DEFAULT_MANAGED_DOMAINS: CreationManagedDomains = {
  spells: false,
  creatureCompendium: false,
  customSystems: false,
}

type CreationEditorContextValue = {
  campaignId: string
  status: CreationEditorStatus
  error: string
  base: CreationState | null
  draft: CreationState | null
  baseRevision: number | null
  updatedAt: string | null
  managedDomains: CreationManagedDomains
  dirty: boolean
  saving: boolean
  updateDraft: (updater: (draft: CreationState) => CreationState) => void
  save: () => Promise<void>
  cancel: () => void
  reload: () => Promise<void>
}

type OwnerChange = {
  characterId: string
  ownerId: string
}

const CreationEditorContext = createContext<CreationEditorContextValue | null>(null)

export function CreationEditorProvider({
  campaignId,
  children,
}: {
  campaignId: string
  children: ReactNode
}) {
  const runtime = useOptionalSessionRuntime()
  const [status, setStatus] = useState<CreationEditorStatus>("loading")
  const [error, setError] = useState("")
  const [base, setBase] = useState<CreationState | null>(null)
  const [draft, setDraft] = useState<CreationState | null>(null)
  const [baseRevision, setBaseRevision] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [managedDomains, setManagedDomains] = useState<CreationManagedDomains>(
    DEFAULT_MANAGED_DOMAINS,
  )
  const [saving, setSaving] = useState(false)

  const applySnapshot = useCallback((snapshot: CreationSnapshot) => {
    const canonical = structuredClone(snapshot.data)
    setBase(canonical)
    setDraft(structuredClone(canonical))
    setBaseRevision(snapshot.revision)
    setUpdatedAt(snapshot.updatedAt)
    setManagedDomains(snapshot.managedDomains ?? DEFAULT_MANAGED_DOMAINS)
    setError("")
    setStatus("ready")
  }, [])

  const loadSnapshot = useCallback(async (force: boolean) => {
    setStatus("loading")
    setError("")
    try {
      applySnapshot(await getCreationSnapshot(campaignId, { force }))
    } catch (cause) {
      setStatus("error")
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o estado de Criação.",
      )
    }
  }, [applySnapshot, campaignId])

  const reload = useCallback(
    async () => loadSnapshot(true),
    [loadSnapshot],
  )

  useEffect(() => {
    // The user area preloads this snapshot before session navigation. Consume
    // that cache here instead of issuing another database request per route.
    void loadSnapshot(false)
  }, [loadSnapshot])

  useEffect(() => {
    setCreationCustomSystemOverride(draft?.customSystems ?? null)
    return () => setCreationCustomSystemOverride(null)
  }, [draft?.customSystems])

  const runtimeRole = runtime?.role
  const runtimeStatus = runtime?.status
  const publishRuntimeConfig = runtime?.publishRuntimeConfig
  const dispatchCharacterLifecycleOperation =
    runtime?.dispatchCharacterLifecycleOperation

  useEffect(() => {
    if (
      runtimeRole !== "MASTER" ||
      runtimeStatus !== "connected" ||
      !publishRuntimeConfig ||
      !base ||
      baseRevision === null
    ) {
      return
    }

    publishRuntimeConfig({
      creationRevision: baseRevision,
      config: toSessionRuntimeConfig(base),
    })
  }, [
    base,
    baseRevision,
    publishRuntimeConfig,
    runtimeRole,
    runtimeStatus,
  ])

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

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) return false
    if (currentLocation.pathname === nextLocation.pathname) return false

    const creationRoot = `/session/${campaignId}/creation`
    return !nextLocation.pathname.startsWith(creationRoot)
  })

  useEffect(() => {
    if (blocker.state !== "blocked") return

    const shouldLeave = window.confirm(
      "Há alterações de Criação não salvas. Deseja sair e descartá-las?",
    )

    if (shouldLeave) blocker.proceed()
    else blocker.reset()
  }, [blocker])

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

    const ownerChanges = collectOwnerChanges(base, draft)
    if (
      ownerChanges.length > 0 &&
      (
        runtimeRole !== "MASTER" ||
        runtimeStatus !== "connected" ||
        !dispatchCharacterLifecycleOperation
      )
    ) {
      const message =
        "Não é possível alterar o jogador responsável enquanto o Session Server não estiver conectado como mestre."
      setError(message)
      throw new Error(message)
    }

    setSaving(true)
    setError("")
    try {
      let ownerDirectory = new Map<string, {
        id: string
        name: string
        role: "master" | "player"
      }>()

      if (ownerChanges.length > 0) {
        const settings = await getSessionCreationSettings(campaignId, {
          force: true,
        })
        const activeUsers = [settings.owner, ...settings.members].filter(
          (member) => member.status === "ACTIVE",
        )
        ownerDirectory = new Map(
          activeUsers.map((member) => [
            member.id,
            {
              id: member.id,
              name: member.name,
              role: member.role === "MASTER" ? "master" as const : "player" as const,
            },
          ]),
        )

        const missingOwner = ownerChanges.find(
          (change) => !ownerDirectory.has(change.ownerId),
        )
        if (missingOwner) {
          throw new Error(
            "O jogador atribuído precisa ser um membro ativo da campanha.",
          )
        }
      }

      const snapshot = await saveCreationSnapshot(
        campaignId,
        baseRevision,
        draft,
      )
      applySnapshot(snapshot)

      let ownershipSyncFailed = false
      for (const change of ownerChanges) {
        const owner = ownerDirectory.get(change.ownerId)
        if (!owner || !dispatchCharacterLifecycleOperation) continue
        const sent = dispatchCharacterLifecycleOperation({
          type: "character.session.owner.set",
          characterId: change.characterId,
          owner,
        })
        if (!sent) ownershipSyncFailed = true
      }

      if (ownershipSyncFailed) {
        setError(
          "A Criação foi salva, mas a troca de jogador não pôde ser enviada ao Session Server. Reconecte como mestre e refaça a atribuição.",
        )
      }
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
    base,
    baseRevision,
    campaignId,
    dirty,
    dispatchCharacterLifecycleOperation,
    draft,
    runtimeRole,
    runtimeStatus,
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
      managedDomains,
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
      managedDomains,
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

function collectOwnerChanges(
  base: CreationState | null,
  draft: CreationState,
): OwnerChange[] {
  if (!base) return []
  const previousById = new Map(
    base.characters.map((character) => [character.characterId, character]),
  )

  return draft.characters.flatMap((character) => {
    const previous = previousById.get(character.characterId)
    if (!previous || previous.ownerId === character.ownerId) return []
    return [{
      characterId: character.characterId,
      ownerId: character.ownerId,
    }]
  })
}

function creationStatesEqual(left: CreationState, right: CreationState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
