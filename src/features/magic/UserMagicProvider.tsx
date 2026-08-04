import {
  useCallback,
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
import { MagicProvider } from "../../contexts/magicContext"
import type { Spell } from "../../models/magic/spells/Spell"

export function UserMagicProvider({
  children,
}: {
  children: ReactNode
}) {
  const [records, setRecords] = useState<AccessibleHomebrewSpell[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")

    try {
      setRecords(await getAccessibleHomebrewSpells())
    } catch {
      setErrorMessage("Não foi possível carregar as magias homebrew.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

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
      value={{ records, loading, errorMessage, reload }}
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

import { createContext, useContext } from "react"

type UserMagicState = {
  records: AccessibleHomebrewSpell[]
  loading: boolean
  errorMessage: string
  reload: () => Promise<void>
}

const UserMagicStateContext = createContext<UserMagicState | null>(null)

export function useUserMagicState(): UserMagicState {
  const context = useContext(UserMagicStateContext)

  if (!context) {
    throw new Error(
      "useUserMagicState precisa estar dentro de UserMagicProvider.",
    )
  }

  return context
}
