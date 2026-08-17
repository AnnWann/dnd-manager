import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react"

import { useSyncContext } from "../contexts/syncContext"
import {
  LocalInitiativeRepository,
  SharedInitiativeRepository,
  type InitiativeRepository,
} from "../lib/initiativeRepository"
import {
  createInitiativeSession,
  type InitiativeSession,
} from "../models/initiative/Initiative"

const PLAYER_POLL_INTERVAL_MS = 1500

export function useInitiativeSession(
  repositoryOverride?: InitiativeRepository,
) {
  const { syncKey, canSync, userRole } = useSyncContext()
  const writable = userRole === "master"
  const repository = useMemo(
    () =>
      repositoryOverride ??
      (canSync
        ? new SharedInitiativeRepository(syncKey, writable)
        : new LocalInitiativeRepository()),
    [canSync, repositoryOverride, syncKey, writable],
  )
  const [session, setSession] = useState<InitiativeSession>(() =>
    createInitiativeSession(),
  )
  const [hydrated, setHydrated] = useState(false)
  const sessionRef = useRef(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    let active = true
    setHydrated(false)

    void repository
      .load()
      .then((storedSession) => {
        if (!active) return
        sessionRef.current = storedSession
        setSession(storedSession)
        setHydrated(true)
      })
      .catch(() => {
        if (!active) return
        setHydrated(true)
      })

    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!hydrated || !writable) return
    void repository.save(session)
  }, [hydrated, repository, session, writable])

  useEffect(() => {
    if (!hydrated || writable || !canSync) return

    let active = true
    let loading = false

    const refresh = async () => {
      if (loading) return
      loading = true
      try {
        const remote = await repository.load()
        if (!active) return
        if (JSON.stringify(remote) !== JSON.stringify(sessionRef.current)) {
          sessionRef.current = remote
          setSession(remote)
        }
      } finally {
        loading = false
      }
    }

    const timer = window.setInterval(() => void refresh(), PLAYER_POLL_INTERVAL_MS)
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [canSync, hydrated, repository, writable])

  const updateSession = useCallback(
    (action: SetStateAction<InitiativeSession>) => {
      if (!writable) return
      setSession(action)
    },
    [writable],
  )

  const resetSession = useCallback(async () => {
    if (!writable) return
    const emptySession = await repository.clear()
    sessionRef.current = emptySession
    setSession(emptySession)
    setHydrated(true)
  }, [repository, writable])

  return {
    session,
    updateSession,
    resetSession,
    hydrated,
    readOnly: !writable,
  }
}
