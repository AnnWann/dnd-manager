import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
} from "react"

import {
  LocalInitiativeRepository,
  type InitiativeRepository,
} from "../lib/initiativeRepository"
import {
  createInitiativeSession,
  type InitiativeSession,
} from "../models/initiative/Initiative"

export function useInitiativeSession(
  repositoryOverride?: InitiativeRepository,
) {
  const repository = useMemo(
    () => repositoryOverride ?? new LocalInitiativeRepository(),
    [repositoryOverride],
  )
  const [session, setSession] = useState<InitiativeSession>(() =>
    createInitiativeSession(),
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let active = true

    void repository.load().then((storedSession) => {
      if (!active) return
      setSession(storedSession)
      setHydrated(true)
    })

    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!hydrated) return
    void repository.save(session)
  }, [hydrated, repository, session])

  const updateSession = useCallback((action: SetStateAction<InitiativeSession>) => {
    setSession(action)
  }, [])

  const resetSession = useCallback(async () => {
    const emptySession = await repository.clear()
    setSession(emptySession)
    setHydrated(true)
  }, [repository])

  return {
    session,
    updateSession,
    resetSession,
    hydrated,
  }
}
