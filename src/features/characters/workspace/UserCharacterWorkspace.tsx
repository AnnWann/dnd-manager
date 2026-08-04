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
  const { data: session } =
    authClient.useSession()

  const localUser =
    LOCAL_AUTH_BYPASS
      ? getLocalUser()
      : null

  const user =
    session?.user ?? localUser

  const [character, setCharacter] =
    useState<CharacterTemplate | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [notFound, setNotFound] =
    useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setNotFound(false)

      try {
        const result =
          await getMyCharacter(characterId)

        if (!active) return

        setCharacter(
          CharacterTemplate.fromJSON({
            ...result.data,
            id: result.id,
            name: result.name,
          }),
        )
      } catch {
        if (active) {
          setNotFound(true)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [characterId])

  const updateCharacter = useCallback(
    (
      targetId: string,
      updater: (
        current: CharacterTemplate,
      ) => CharacterTemplate,
    ) => {
      setCharacter((current) => {
        if (
          !current ||
          current.get("id") !== targetId
        ) {
          return current
        }

        const updated = updater(current)

        void updateMyCharacter(
          targetId,
          updated.toJSON(),
        )

        return updated
      })
    },
    [],
  )

  const currentOwner =
    useMemo<Player | undefined>(() => {
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

  const value: CharacterWorkspaceValue = {
    mode: "user",

    characters: [character],
    activeCharacter: character,
    selectedCharacterId:
      character.get("id"),

    setSelectedCharacterId: () => {
      // A rota já determina o personagem ativo.
    },

    updateCharacter,

    deleteCharacter: () => {
      // Será conectado ao DELETE da API.
    },

    partyInventory: [],

    canAssignOwners: false,
    canEditCharacterType: true,

    owners:
      currentOwner
        ? [currentOwner]
        : [],

    currentOwner,
  }

  return (
    <CharacterWorkspaceProvider value={value}>
      {children}
    </CharacterWorkspaceProvider>
  )
}