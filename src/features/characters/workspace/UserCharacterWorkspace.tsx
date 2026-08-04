import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  getMyCharacter,
  updateMyCharacter,
} from "../../../api/user-characters"
import { authClient } from "../../../auth/auth-client"
import {
  getLocalUser,
  LOCAL_AUTH_BYPASS,
} from "../../../auth/local-auth"
import { takeLongRest } from "../../../models/characters/characterRest"
import { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"
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

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setNotFound(false)

      try {
        const result = await getMyCharacter(characterId)

        if (!active) return

        setCharacter(
          CharacterTemplate.fromJSON({
            ...result.data,
            id: result.id,
            name: result.name,
          }),
        )
      } catch {
        if (active) setNotFound(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [characterId])

  const persistCharacter = useCallback(
    (updated: CharacterTemplate) => {
      void updateMyCharacter(
        updated.get("id"),
        updated.toJSON() as unknown as Record<string, unknown>,
      )
    },
    [],
  )

  const updateCharacter = useCallback(
    (
      targetId: string,
      updater: (current: CharacterTemplate) => CharacterTemplate,
    ) => {
      setCharacter((current) => {
        if (!current || current.get("id") !== targetId) {
          return current
        }

        const updated = updater(current)
        persistCharacter(updated)
        return updated
      })
    },
    [persistCharacter],
  )

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
    deleteCharacter: () => {},
    completeLongRest: (targetId) => {
      updateCharacter(targetId, takeLongRest)
    },
    partyInventory: [],
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
      {children}
    </CharacterWorkspaceProvider>
  )
}
