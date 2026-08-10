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
} from "../../../api/user-characters"
import { authClient } from "../../../auth/auth-client"
import {
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "../../../auth/local-auth"
import { applyCharacterDomains } from "../../../lib/characterDomains"
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

  const [character, setCharacter] =
    useState<CharacterTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [persistenceError, setPersistenceError] = useState("")
  const characterRef = useRef<CharacterTemplate | null>(null)
  const persistenceRef = useRef<UserCharacterDomainPersistence | null>(null)

  useEffect(() => {
    let active = true
    characterRef.current = null
    persistenceRef.current = null

    async function load() {
      setLoading(true)
      setNotFound(false)
      setPersistenceError("")

      try {
        const result = await getMyCharacter(characterId)

        if (!active) return

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
        const normalizedCharacter = ensureCharacterAcquisitionMetadata(parsed, {
          reason: "import",
          sourceType: "import",
          sourceName: "Compatibilidade de ficha existente",
        })

        if (!LOCAL_AUTH_BYPASS) {
          const persistence = new UserCharacterDomainPersistence(
            result.id,
            result.revision ?? 1,
            result.domains ?? [],
            (conflict) => {
              if (!active) return
              setPersistenceError(
                `Conflito de edição em ${formatDomainName(conflict.domain)}. Recarregue a ficha antes de continuar editando esse campo.`,
              )
            },
            (error) => {
              if (!active) return
              setPersistenceError(
                error instanceof Error
                  ? error.message
                  : "Não foi possível persistir uma alteração da ficha.",
              )
            },
          )
          persistenceRef.current = persistence
          await persistence.bootstrapMissingDomains(normalizedCharacter.toJSON())
        }

        if (!active) return
        characterRef.current = normalizedCharacter
        setCharacter(normalizedCharacter)
      } catch {
        if (active) setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
      characterRef.current = null
      persistenceRef.current = null
    }
  }, [characterId])

  const persistCharacter = useCallback(
    (
      previous: CharacterTemplate,
      updated: CharacterTemplate,
    ) => {
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
        )
        return
      }

      persistenceRef.current?.persistChange(
        previous.toJSON(),
        updated.toJSON(),
      )
    },
    [],
  )

  const updateCharacter = useCallback(
    (
      targetId: string,
      updater: (current: CharacterTemplate) => CharacterTemplate,
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

      setPersistenceError("")
      characterRef.current = withMetadata
      setCharacter(withMetadata)
      persistCharacter(current, withMetadata)
    },
    [persistCharacter],
  )

  const deleteCharacter = useCallback((targetId: string) => {
    const current = characterRef.current
    if (!current || current.get("id") !== targetId) return

    characterRef.current = null
    persistenceRef.current = null
    setCharacter(null)

    void deleteMyCharacter(targetId).catch(() => {
      setNotFound(false)
    })
  }, [])

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
