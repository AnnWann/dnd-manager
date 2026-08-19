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
import {
  applyCharacterDomains,
  getChangedCharacterDomains,
} from "../../../lib/characterDomains"
import type { CharacterDomainName } from "../../../lib/relationalApi"
import { UserCharacterDomainPersistence } from "../../../lib/userCharacterDomainPersistence"
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
import {
  readUserCharacterCache,
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

  const [character, setCharacter] =
    useState<CharacterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [persistenceError, setPersistenceError] = useState("")
  const characterRef = useRef<CharacterTemplate | null>(null)
  const summaryRef = useRef<UserCharacterSummary | null>(null)
  const persistenceRef = useRef<UserCharacterDomainPersistence | null>(null)
  const localMutationVersionRef = useRef(0)

  const createPersistence = useCallback((
    summary: UserCharacterSummary,
    active: () => boolean,
  ) => {
    if (LOCAL_AUTH_BYPASS) return null

    return new UserCharacterDomainPersistence(
      summary.id,
      summary.revision ?? 1,
      summary.domains ?? [],
      (conflict) => {
        if (!active()) return
        setPersistenceError(
          `Conflito de edição em ${formatDomainName(conflict.domain)}. Recarregue a ficha antes de continuar editando esse campo.`,
        )
      },
      (error) => {
        if (!active()) return
        setPersistenceError(
          error instanceof Error
            ? error.message
            : "Não foi possível persistir uma alteração da ficha.",
        )
      },
    )
  }, [])

  useEffect(() => {
    if (!userId) return

    let active = true
    const isActive = () => active
    characterRef.current = null
    summaryRef.current = null
    persistenceRef.current = null
    localMutationVersionRef.current = 0
    setNotFound(false)
    setPersistenceError("")

    const cached = readUserCharacterCache<UserCharacterSummary>(userId, characterId)
    let hasUsableCache = false

    if (cached?.id === characterId) {
      try {
        const cachedCharacter = hydrateWorkspaceCharacter(cached)
        summaryRef.current = cached
        characterRef.current = cachedCharacter
        persistenceRef.current = createPersistence(cached, isActive)
        setCharacter(cachedCharacter)
        setLoading(false)
        hasUsableCache = true
      } catch {
        removeUserCharacterCache(userId, characterId)
      }
    }

    if (!hasUsableCache) {
      setCharacter(null)
      setLoading(true)
    }

    const mutationVersionAtRequest = localMutationVersionRef.current

    async function revalidate() {
      try {
        const result = await getMyCharacter(characterId)
        if (!active) return

        if (localMutationVersionRef.current !== mutationVersionAtRequest) {
          return
        }

        const normalizedCharacter = hydrateWorkspaceCharacter(result)
        const persistence = createPersistence(result, isActive)

        if (persistence) {
          await persistence.bootstrapMissingDomains(normalizedCharacter.toJSON())
          if (!active) return
          if (localMutationVersionRef.current !== mutationVersionAtRequest) return
        }

        writeUserCharacterCache(userId, characterId, result)
        summaryRef.current = result
        persistenceRef.current = persistence
        characterRef.current = normalizedCharacter
        setCharacter(normalizedCharacter)
        setNotFound(false)
      } catch {
        if (!active) return
        if (!hasUsableCache) setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void revalidate()

    return () => {
      active = false
      characterRef.current = null
      summaryRef.current = null
      persistenceRef.current = null
    }
  }, [characterId, createPersistence, userId])

  const cacheCharacter = useCallback((updated: CharacterTemplate) => {
    if (!userId) return
    const currentSummary = summaryRef.current
    if (!currentSummary) return

    const nextSummary: UserCharacterSummary = {
      ...currentSummary,
      name: updated.get("name"),
      visibility: toApiVisibility(updated.get("visibility")),
      data: updated.toJSON() as unknown as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    }

    summaryRef.current = nextSummary
    writeUserCharacterCache(userId, updated.get("id"), nextSummary)
  }, [userId])

  const persistCharacter = useCallback(
    (
      previous: CharacterTemplate,
      updated: CharacterTemplate,
    ) => {
      cacheCharacter(updated)

      if (LOCAL_AUTH_BYPASS) {
        const data = normalizeStandardItemsInValue(
          updated.toJSON(),
        ) as Record<string, unknown>

        void updateMyCharacter(
          updated.get("id"),
          data,
          {
            name: updated.get("name"),
            visibility: toApiVisibility(updated.get("visibility")),
          },
        ).then((fresh) => {
          summaryRef.current = fresh
          if (userId) writeUserCharacterCache(userId, fresh.id, fresh)
        })
        return
      }

      persistenceRef.current?.persistChange(
        previous.toJSON(),
        updated.toJSON(),
      )
    },
    [cacheCharacter, userId],
  )

  const applyCharacterUpdate = useCallback(
    (
      targetId: string,
      updater: (current: CharacterTemplate) => CharacterTemplate,
      declaredDomain?: CharacterDomainName,
    ) => {
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
        const changedDomains = getChangedCharacterDomains(
          current.toJSON(),
          withMetadata.toJSON(),
        )
        const unexpected = changedDomains.filter(
          (domain) => domain !== declaredDomain,
        )
        if (unexpected.length) {
          console.warn(
            `Updater de ${declaredDomain} alterou domínios fora do ownership: ${unexpected.join(", ")}.`,
          )
        }
      }

      localMutationVersionRef.current += 1
      setPersistenceError("")
      characterRef.current = withMetadata
      setCharacter(withMetadata)
      persistCharacter(current, withMetadata)
    },
    [persistCharacter],
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
    const current = characterRef.current
    if (!current || current.get("id") !== targetId) return

    characterRef.current = null
    summaryRef.current = null
    persistenceRef.current = null
    setCharacter(null)
    if (userId) removeUserCharacterCache(userId, targetId)

    void deleteMyCharacter(targetId).catch(() => {
      setNotFound(false)
    })
  }, [userId])

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
      <div className="grid min-h-64 place-items-center text-sm text-textMuted">
        Carregando ficha...
      </div>
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
    canEditCharacterType: true,
    owners: [fallbackOwner],
    currentOwner: fallbackOwner,
    knownPlayerKeys: [fallbackOwner.id],
    getOwner,
    createOwner,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      {persistenceError ? (
        <div className="mb-3 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {persistenceError}
        </div>
      ) : null}
      {children}
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

function formatDomainName(domain: string): string {
  const labels: Record<string, string> = {
    root: "identidade",
    sheet: "dados da ficha",
    vitals: "vida e condições",
    profile: "perfil",
    abilities: "características",
    magic: "magia",
    inventory: "inventário",
    equipment: "equipamento",
    progression: "progressão",
    notes: "notas",
  }
  return labels[domain] ?? domain
}
