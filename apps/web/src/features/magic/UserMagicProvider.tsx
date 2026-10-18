import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getOfficialSpellsByIndexes } from "../../api/spell-compendium"
import {
  archiveOwnedHomebrewSpell,
  createOwnedHomebrewSpell,
  getAccessibleHomebrewSpells,
  updateOwnedHomebrewSpell,
  type AccessibleHomebrewSpell,
} from "../../api/user-spells"
import { authClient } from "../../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../../auth/local-auth"
import { MagicProvider } from "../../contexts/magicContext"
import { collectReferencedSpellIndexes } from "../../lib/spellReferences"
import type { Spell } from "../../models/magic/spells/Spell"
import { useUserData } from "../user/UserDataProvider"
import {
  readUserCacheSnapshot,
  writeUserCache,
} from "../user/userPersistentCache"

type UserMagicState = {
  records: AccessibleHomebrewSpell[]
  loading: boolean
  refreshing: boolean
  errorMessage: string
  bootstrapError: string
  reload: () => Promise<void>
}

const UserMagicStateContext = createContext<UserMagicState | null>(null)
const spellRequests = new Map<string, Promise<AccessibleHomebrewSpell[]>>()

function fetchSpellsOnce(userId: string): Promise<AccessibleHomebrewSpell[]> {
  const existing = spellRequests.get(userId)
  if (existing) return existing

  const request = getAccessibleHomebrewSpells().finally(() => {
    if (spellRequests.get(userId) === request) spellRequests.delete(userId)
  })
  spellRequests.set(userId, request)
  return request
}

export function UserMagicProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const userId = session?.user?.id ?? localUser?.id ?? ""
  const { characters, charactersLoading } = useUserData()

  const [records, setRecordsState] = useState<AccessibleHomebrewSpell[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [characterSpellsLoading, setCharacterSpellsLoading] = useState(true)
  const [characterOfficialSpells, setCharacterOfficialSpells] = useState<Spell[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [recordsBootstrapError, setRecordsBootstrapError] = useState("")
  const [characterSpellsBootstrapError, setCharacterSpellsBootstrapError] = useState("")

  const setRecords = useCallback(
    (next: AccessibleHomebrewSpell[] | ((current: AccessibleHomebrewSpell[]) => AccessibleHomebrewSpell[])) => {
      setRecordsState((current) => {
        const resolved = typeof next === "function" ? next(current) : next
        if (userId) writeUserCache(userId, "spells", resolved)
        return resolved
      })
    },
    [userId],
  )

  const reload = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    setErrorMessage("")

    try {
      const next = await fetchSpellsOnce(userId)
      setRecordsState(next)
      writeUserCache(userId, "spells", next, { synced: true })
    } catch {
      setErrorMessage("Não foi possível atualizar as magias homebrew.")
    } finally {
      setRefreshing(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    let active = true
    const cached = readUserCacheSnapshot<AccessibleHomebrewSpell[]>(userId, "spells")
    const shouldRefresh = !cached?.fresh

    setRecordsBootstrapError("")
    setErrorMessage("")
    setRecordsState(cached?.data ?? [])
    setRecordsLoading(shouldRefresh)

    if (!shouldRefresh) {
      return () => {
        active = false
      }
    }

    void fetchSpellsOnce(userId)
      .then((next) => {
        if (!active) return
        setRecordsState(next)
        writeUserCache(userId, "spells", next, { synced: true })
      })
      .catch(() => {
        if (!active) return
        setErrorMessage("Não foi possível atualizar as magias homebrew.")
        if (!cached) {
          setRecordsBootstrapError(
            "Não foi possível carregar as magias para iniciar a área do usuário.",
          )
        }
      })
      .finally(() => {
        if (active) setRecordsLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!userId || charactersLoading) {
      setCharacterSpellsLoading(true)
      return
    }

    let active = true
    const indexes = Array.from(
      new Set(
        characters.flatMap((character) =>
          collectReferencedSpellIndexes(character.data),
        ),
      ),
    )

    setCharacterSpellsBootstrapError("")

    if (!indexes.length) {
      setCharacterOfficialSpells([])
      setCharacterSpellsLoading(false)
      return () => {
        active = false
      }
    }

    setCharacterSpellsLoading(true)
    void getOfficialSpellsByIndexes(indexes)
      .then((spells) => {
        if (!active) return
        setCharacterOfficialSpells(spells)
      })
      .catch(() => {
        if (!active) return
        setCharacterSpellsBootstrapError(
          "Não foi possível carregar as magias usadas pelos seus personagens.",
        )
      })
      .finally(() => {
        if (active) setCharacterSpellsLoading(false)
      })

    return () => {
      active = false
    }
  }, [characters, charactersLoading, userId])

  const spells = useMemo(
    () => records.map((record) => record.data),
    [records],
  )

  const recordByIndex = useMemo(
    () => new Map(records.map((record) => [record.index, record])),
    [records],
  )

  function saveSpell(spell: Spell) {
    const current = recordByIndex.get(spell.index)

    if (current && !current.ownedByCurrentUser) {
      setErrorMessage(
        "Magias compartilhadas por campanha só podem ser alteradas pelo autor.",
      )
      return
    }

    if (current) {
      setRecords((previous) =>
        previous.map((record) =>
          record.id === current.id
            ? {
                ...record,
                name: spell.name,
                data: {
                  ...spell,
                  index: record.index,
                  homebrew: true,
                },
              }
            : record,
        ),
      )

      void updateOwnedHomebrewSpell(current, spell)
        .then((updated) => {
          setRecords((previous) =>
            previous.map((record) =>
              record.id === updated.id ? updated : record,
            ),
          )
        })
        .catch(() => {
          setErrorMessage(
            "Não foi possível salvar a magia. Recarregue para evitar conflitos.",
          )
          void reload()
        })
      return
    }

    void createOwnedHomebrewSpell(spell)
      .then((created) => {
        setRecords((previous) => [created, ...previous])
      })
      .catch(() => {
        setErrorMessage("Não foi possível criar a magia homebrew.")
      })
  }

  function deleteSpell(spellIndex: string) {
    const current = recordByIndex.get(spellIndex)

    if (!current?.ownedByCurrentUser) {
      setErrorMessage(
        "Somente o autor pode arquivar esta magia homebrew.",
      )
      return
    }

    setRecords((previous) =>
      previous.filter((record) => record.id !== current.id),
    )

    void archiveOwnedHomebrewSpell(current).catch(() => {
      setErrorMessage("Não foi possível arquivar a magia.")
      void reload()
    })
  }

  const loading = recordsLoading || characterSpellsLoading
  const bootstrapError =
    recordsBootstrapError || characterSpellsBootstrapError

  return (
    <UserMagicStateContext.Provider
      value={{
        records,
        loading,
        refreshing,
        errorMessage,
        bootstrapError,
        reload,
      }}
    >
      <MagicProvider
        spells={spells}
        preloadedOfficialSpells={characterOfficialSpells}
        onSaveSpell={saveSpell}
        onDeleteSpell={deleteSpell}
      >
        {children}
      </MagicProvider>
    </UserMagicStateContext.Provider>
  )
}

export function useUserMagicState(): UserMagicState {
  const context = useContext(UserMagicStateContext)

  if (!context) {
    throw new Error(
      "useUserMagicState precisa estar dentro de UserMagicProvider.",
    )
  }

  return context
}
