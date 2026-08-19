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
  archiveOwnedHomebrewSpell,
  createOwnedHomebrewSpell,
  getAccessibleHomebrewSpells,
  updateOwnedHomebrewSpell,
  type AccessibleHomebrewSpell,
} from "../../api/user-spells"
import { authClient } from "../../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../../auth/local-auth"
import { MagicProvider } from "../../contexts/magicContext"
import type { Spell } from "../../models/magic/spells/Spell"
import { readUserCache, writeUserCache } from "../user/userPersistentCache"

type UserMagicState = {
  records: AccessibleHomebrewSpell[]
  loading: boolean
  refreshing: boolean
  errorMessage: string
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

  const [records, setRecordsState] = useState<AccessibleHomebrewSpell[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

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
      setRecords(await fetchSpellsOnce(userId))
    } catch {
      setErrorMessage("Não foi possível atualizar as magias homebrew.")
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [setRecords, userId])

  useEffect(() => {
    if (!userId) return

    const cached = readUserCache<AccessibleHomebrewSpell[]>(userId, "spells")
    setRecordsState(cached ?? [])
    setLoading(!cached)
    void reload()
  }, [reload, userId])

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

  return (
    <UserMagicStateContext.Provider
      value={{ records, loading, refreshing, errorMessage, reload }}
    >
      <MagicProvider
        spells={spells}
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
