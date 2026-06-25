import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  LocalCreatureCompendiumRepository,
  type CreatureCompendiumRepository,
} from "../lib/creatureCompendiumRepository"
import {
  duplicateCompendiumCreature,
  type CompendiumCreature,
  type CreatureCompendiumState,
} from "../models/creatures/CompendiumCreature"

type CreatureCompendiumContextValue = {
  creatures: CompendiumCreature[]
  hydrated: boolean
  upsertCreature: (creature: CompendiumCreature) => void
  deleteCreature: (creatureId: string) => void
  duplicateCreature: (creatureId: string) => CompendiumCreature | undefined
  clearCompendium: () => Promise<void>
}

type CreatureCompendiumProviderProps = {
  children: ReactNode
  repository?: CreatureCompendiumRepository
}

const CreatureCompendiumContext =
  createContext<CreatureCompendiumContextValue | null>(null)

export function CreatureCompendiumProvider({
  children,
  repository: repositoryOverride,
}: CreatureCompendiumProviderProps) {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalCreatureCompendiumRepository(),
    [repositoryOverride],
  )
  const [state, setState] = useState<CreatureCompendiumState>({
    version: 1,
    creatures: [],
    updatedAt: Date.now(),
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true

    void repository.load().then((storedState) => {
      if (!active) return
      setState(storedState)
      setHydrated(true)
    })

    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!hydrated) return
    void repository.save(state)
  }, [hydrated, repository, state])

  function upsertCreature(creature: CompendiumCreature) {
    setState((current) => {
      const exists = current.creatures.some((entry) => entry.id === creature.id)
      const nextCreature = { ...creature, updatedAt: Date.now() }
      const creatures = exists
        ? current.creatures.map((entry) =>
            entry.id === creature.id ? nextCreature : entry,
          )
        : [...current.creatures, nextCreature]

      return {
        ...current,
        creatures: creatures.sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
        updatedAt: Date.now(),
      }
    })
  }

  function deleteCreature(creatureId: string) {
    setState((current) => ({
      ...current,
      creatures: current.creatures.filter((entry) => entry.id !== creatureId),
      updatedAt: Date.now(),
    }))
  }

  function duplicateCreature(creatureId: string): CompendiumCreature | undefined {
    const source = state.creatures.find((entry) => entry.id === creatureId)
    if (!source) return undefined

    const duplicate = duplicateCompendiumCreature(source)
    upsertCreature(duplicate)
    return duplicate
  }

  async function clearCompendium() {
    const emptyState = await repository.clear()
    setState(emptyState)
    setHydrated(true)
  }

  return (
    <CreatureCompendiumContext.Provider
      value={{
        creatures: state.creatures,
        hydrated,
        upsertCreature,
        deleteCreature,
        duplicateCreature,
        clearCompendium,
      }}
    >
      {children}
    </CreatureCompendiumContext.Provider>
  )
}

export function useCreatureCompendium() {
  const context = useContext(CreatureCompendiumContext)

  if (!context) {
    throw new Error(
      "useCreatureCompendium must be used inside CreatureCompendiumProvider",
    )
  }

  return context
}
