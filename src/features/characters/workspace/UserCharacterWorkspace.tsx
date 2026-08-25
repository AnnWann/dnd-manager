import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  deleteMyCharacter,
  getMyCharacter,
  updateMyCharacter,
  type CharacterVisibility,
  type UserCharacterSummary,
} from "../../../api/user-characters"
import { authClient } from "../../../auth/auth-client"
import {
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "../../../auth/local-auth"
import { AppLoadingScreen } from "../../../components/AppLoadingScreen"
import { Button } from "../../../components/ui/Button"
import { applyCharacterDomains } from "../../../lib/characterDomains"
import type { CharacterDomainName } from "../../../lib/relationalApi"
import { moveEquippedItemToCharacterStorage } from "../../../models/characters/characterEquippedItemMovement"
import { stowHandOccupant as stowCharacterHandOccupant } from "../../../models/characters/characterHands"
import { takeLongRest } from "../../../models/characters/characterRest"
import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../models/characters/CharacterTemplate"
import { ensureCharacterAcquisitionMetadata } from "../../../models/characters/characterAcquisitionMetadata"
import type { Player } from "../../../models/player/Player"
import { normalizeStandardItemsInValue } from "../../items/standardItemCompendium"
import { useUserData } from "../../user/UserDataProvider"
import {
  readUserCharacterCacheSnapshot,
  removeUserCharacterCache,
  writeUserCharacterCache,
} from "../../user/userPersistentCache"
import {
  CharacterWorkspaceProvider,
  type CharacterWorkspaceValue,
} from "./CharacterWorkspaceContext"

export function UserCharacterWorkspace({
  characterId,
  children,
}: {
  characterId: string
  children: ReactNode
}) {
  const { data: session } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const user = session?.user ?? localUser
  const userId = user?.id ?? ""
  const { setCharacters } = useUserData()

  const [character, setCharacter] = useState<CharacterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [persistenceError, setPersistenceError] = useState("")

  const characterRef = useRef<CharacterTemplate | null>(null)
  const summaryRef = useRef<UserCharacterSummary | null>(null)
  const savedJsonRef = useRef<CharacterTemplateProps | null>(null)

  const installSavedCharacter = useCallback((summary: UserCharacterSummary) => {
    const hydrated = hydrateWorkspaceCharacter(summary)
    summaryRef.current = summary
    savedJsonRef.current = hydrated.toJSON()
    characterRef.current = hydrated
    setCharacter(hydrated)
    setNotFound(false)
    setIsEditing(false)
    setPersistenceError("")
  }, [])

  useEffect(() => {
    if (!userId) return

    let active = true
    setLoading(true)
    setNotFound(false)
    setIsEditing(false)
    setIsSaving(false)
    setPersistenceError("")
    characterRef.current = null
    summaryRef.current = null
    savedJsonRef.current = null

    const cachedSnapshot = readUserCharacterCacheSnapshot<UserCharacterSummary>(
      userId,
      characterId,
    )
    const cached = cachedSnapshot?.data

    if (cached?.id === characterId && cachedSnapshot?.fresh) {
      try {
        installSavedCharacter(cached)
        setLoading(false)
        return () => {
          active = false
        }
      } catch {
        removeUserCharacterCache(userId, characterId)
      }
    }

    void getMyCharacter(characterId)
      .then((fresh) => {
        if (!active) return
        writeUserCharacterCache(userId, characterId, fresh, { synced: true })
        installSavedCharacter(fresh)
      })
      .catch(() => {
        if (!active) return
        if (cached?.id === characterId) {
          try {
            installSavedCharacter(cached)
            setPersistenceError(
              "Não foi possível confirmar a versão mais recente da ficha. Recarregue antes de editar.",
            )
            return
          } catch {
            removeUserCharacterCache(userId, characterId)
          }
        }
        setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      characterRef.current = null
      summaryRef.current = null
      savedJsonRef.current = null
    }
  }, [characterId, installSavedCharacter, userId])

  const dirty = useMemo(() => {
    if (!isEditing || !character || !savedJsonRef.current) return false
    return !characterJsonEqual(savedJsonRef.current, character.toJSON())
  }, [character, isEditing])

  useEffect(() => {
    if (!dirty) return

    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [dirty])

  const beginEditing = useCallback(() => {
    if (!characterRef.current || isSaving) return
    setPersistenceError("")
    setIsEditing(true)
  }, [isSaving])

  const cancelEditing = useCallback(() => {
    if (isSaving) return
    const saved = savedJsonRef.current
    if (!saved) return

    const restored = CharacterTemplate.fromJSON(saved)
    characterRef.current = restored
    setCharacter(restored)
    setPersistenceError("")
    setIsEditing(false)
  }, [isSaving])

  const saveCharacter = useCallback(async () => {
    const current = characterRef.current
    const summary = summaryRef.current
    if (!current || !summary || !dirty || isSaving) return

    setIsSaving(true)
    setPersistenceError("")

    try {
      const data = normalizeStandardItemsInValue(
        current.toJSON(),
      ) as Record<string, unknown>

      const fresh = await updateMyCharacter(
        current.get("id"),
        data,
        {
          name: current.get("name"),
          visibility: toApiVisibility(current.get("visibility")),
          expectedVersion: summary.revision,
        },
      )

      const saved = hydrateWorkspaceCharacter(fresh)
      summaryRef.current = fresh
      savedJsonRef.current = saved.toJSON()
      characterRef.current = saved
      setCharacter(saved)
      writeUserCharacterCache(userId, fresh.id, fresh, { synced: true })
      setCharacters((currentCharacters) =>
        currentCharacters.map((entry) =>
          entry.id === fresh.id ? fresh : entry,
        ),
      )
      setIsEditing(false)
    } catch (error) {
      setPersistenceError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a ficha.",
      )
    } finally {
      setIsSaving(false)
    }
  }, [dirty, isSaving, setCharacters, userId])

  const applyCharacterUpdate = useCallback(
    (
      targetId: string,
      updater: (current: CharacterTemplate) => CharacterTemplate,
      declaredDomain?: CharacterDomainName,
    ) => {
      if (!isEditing || isSaving) return

      const current = characterRef.current
      if (!current || current.get("id") !== targetId) return

      const requested = updater(current)
      const normalized = CharacterTemplate.fromJSON(
        normalizeStandardItemsInValue(
          requested.toJSON(),
        ) as Record<string, unknown>,
      )
      const withMetadata = ensureCharacterAcquisitionMetadata(normalized, {
        reason: "manual",
        sourceType: "manual",
        sourceName: "Edição da ficha",
      })

      if (declaredDomain) {
        // Domain ownership remains useful as a development invariant even
        // though user-context persistence is now batched into one Save.
        const before = current.toJSON()
        const after = withMetadata.toJSON()
        if (characterJsonEqual(before, after)) return
      }

      characterRef.current = withMetadata
      setCharacter(withMetadata)
      setPersistenceError("")
    },
    [isEditing, isSaving],
  )

  const updateCharacter = useCallback(
    (
      targetId: string,
      updater: (current: CharacterTemplate) => CharacterTemplate,
    ) => applyCharacterUpdate(targetId, updater),
    [applyCharacterUpdate],
  )

  const updateCharacterDomain = useCallback(
    (
      targetId: string,
      domain: CharacterDomainName,
      updater: (current: CharacterTemplate) => CharacterTemplate,
    ) => applyCharacterUpdate(targetId, updater, domain),
    [applyCharacterUpdate],
  )

  const deleteCharacter = useCallback((targetId: string) => {
    if (!isEditing || isSaving) return
    const current = characterRef.current
    if (!current || current.get("id") !== targetId) return

    void deleteMyCharacter(targetId)
      .then(() => {
        characterRef.current = null
        summaryRef.current = null
        savedJsonRef.current = null
        setCharacter(null)
        removeUserCharacterCache(userId, targetId)
        setCharacters((currentCharacters) =>
          currentCharacters.filter((entry) => entry.id !== targetId),
        )
      })
      .catch(() => {
        setPersistenceError("Não foi possível excluir o personagem.")
      })
  }, [isEditing, isSaving, setCharacters, userId])

  const currentOwner = useMemo<Player | undefined>(() => {
    if (!user) return undefined

    return {
      id: user.id,
      name: user.name,
      role: "player",
    }
  }, [user])

  if (loading) {
    return (
      <AppLoadingScreen
        title="Carregando personagem..."
        detail="Preparando a ficha."
      />
    )
  }

  if (notFound || !character) {
    return (
      <div className="grid min-h-64 place-items-center text-sm text-textMuted">
        Personagem não encontrado.
      </div>
    )
  }

  const fallbackOwner: Player =
    currentOwner ?? character.get("owner") ?? {
      id: "local-user",
      name: "Usuário local",
      role: "player",
    }

  const getOwner = (ownerId: string): Player =>
    ownerId === fallbackOwner.id
      ? fallbackOwner
      : {
          id: ownerId,
          name: ownerId,
          role: "player",
        }

  const createOwner = (ownerName: string): Player => ({
    id: crypto.randomUUID(),
    name: ownerName.trim() || "Novo jogador",
    role: "player",
  })

  const value: CharacterWorkspaceValue = {
    mode: "user",
    isEditing,
    characters: [character],
    activeCharacter: character,
    selectedCharacterId: character.get("id"),
    setSelectedCharacterId: () => {},
    updateCharacter,
    updateCharacterDomain,
    dispatchStatOperation: () => false,
    dispatchAttributeOperation: () => false,
    dispatchSavingThrowOperation: () => false,
    dispatchSkillOperation: () => false,
    dispatchConditionOperation: () => false,
    deleteCharacter,
    completeLongRest: (targetId) => {
      updateCharacter(targetId, takeLongRest)
    },
    partyInventory: [],
    stowHandOccupant: (targetId, reference) => {
      updateCharacter(targetId, (current) =>
        stowCharacterHandOccupant(current, reference),
      )
    },
    moveEquippedItem: (targetId, reference, destination) => {
      updateCharacter(targetId, (current) =>
        moveEquippedItemToCharacterStorage(
          current,
          reference,
          destination,
        ),
      )
    },
    canUseGroundInventory: false,
    canAssignOwners: false,
    canEditCharacterType: isEditing,
    owners: [fallbackOwner],
    currentOwner: fallbackOwner,
    knownPlayerKeys: [fallbackOwner.id],
    getOwner,
    createOwner,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
        <div>
          <div className="text-sm font-semibold text-textH">
            {isEditing ? "Modo de edição" : "Modo de visualização"}
          </div>
          <div className="mt-0.5 text-xs text-textMuted">
            {isEditing
              ? "As alterações ficam locais até você salvar."
              : "A ficha está protegida contra alterações acidentais."}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={isSaving}
                onClick={cancelEditing}
              >
                Cancelar
              </Button>
              {dirty ? (
                <Button
                  size="sm"
                  variant="primary"
                  loading={isSaving}
                  onClick={() => void saveCharacter()}
                >
                  Salvar alterações
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={beginEditing}
            >
              Editar ficha
            </Button>
          )}
        </div>
      </div>

      {persistenceError ? (
        <div className="mb-3 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {persistenceError}
        </div>
      ) : null}

      <div
        className={
          isEditing
            ? undefined
            : "[&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none"
        }
      >
        {children}
      </div>
    </CharacterWorkspaceProvider>
  )
}

function hydrateWorkspaceCharacter(
  result: UserCharacterSummary,
): CharacterTemplate {
  const legacyBase = normalizeStandardItemsInValue({
    ...result.data,
    id: result.id,
    name: result.name,
    visibility: fromApiVisibility(result.visibility),
  }) as CharacterTemplateProps
  const hydratedData = applyCharacterDomains(
    legacyBase,
    result.domains ?? [],
  )
  const parsed = CharacterTemplate.fromJSON(hydratedData)
  return ensureCharacterAcquisitionMetadata(parsed, {
    reason: "import",
    sourceType: "import",
    sourceName: "Compatibilidade de ficha existente",
  })
}

function toApiVisibility(
  visibility: "private" | "party" | "master",
): CharacterVisibility {
  return visibility.toUpperCase() as CharacterVisibility
}

function fromApiVisibility(
  visibility: CharacterVisibility,
): "private" | "party" | "master" {
  return visibility.toLowerCase() as "private" | "party" | "master"
}

function characterJsonEqual(
  left: CharacterTemplateProps,
  right: CharacterTemplateProps,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
