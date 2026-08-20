import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react"

import { useSyncContext } from "../contexts/syncContext"
import { useOptionalSessionRuntime } from "../features/session-runtime/useSessionRuntime"
import type { SessionInitiativeOperation } from "../features/session-runtime/initiativeSessionProtocol"
import {
  LocalInitiativeRepository,
  SharedInitiativeRepository,
  type InitiativeRepository,
} from "../lib/initiativeRepository"
import {
  createInitiativeSession,
  normalizeInitiativeSession,
  type InitiativeEntry,
  type InitiativeSession,
} from "../models/initiative/Initiative"

const PLAYER_POLL_INTERVAL_MS = 1500

export function useInitiativeSession(
  repositoryOverride?: InitiativeRepository,
) {
  const { syncKey, canSync, userRole } = useSyncContext()
  const runtime = useOptionalSessionRuntime()
  const writable = runtime ? runtime.role === "MASTER" : userRole === "master"
  const repository = useMemo(
    () =>
      repositoryOverride ??
      (canSync
        ? new SharedInitiativeRepository(syncKey, writable)
        : new LocalInitiativeRepository()),
    [canSync, repositoryOverride, syncKey, writable],
  )
  const [localSession, setLocalSession] = useState<InitiativeSession>(() =>
    createInitiativeSession(),
  )
  const [localHydrated, setLocalHydrated] = useState(false)
  const localSessionRef = useRef(localSession)

  const session = useMemo(
    () => runtime?.initiativeState?.initialized
      ? normalizeInitiativeSession(runtime.initiativeState.session)
      : localSession,
    [localSession, runtime?.initiativeState],
  )
  const sessionRef = useRef(session)

  useEffect(() => {
    localSessionRef.current = localSession
  }, [localSession])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // The legacy repository is only a seed for the first authoritative session
  // initialization. Outside /session it remains the persistence boundary.
  useEffect(() => {
    let active = true
    setLocalHydrated(false)

    void repository
      .load()
      .then((storedSession) => {
        if (!active) return
        localSessionRef.current = storedSession
        setLocalSession(storedSession)
        setLocalHydrated(true)
      })
      .catch(() => {
        if (!active) return
        setLocalHydrated(true)
      })

    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (runtime || !localHydrated || !writable) return
    void repository.save(localSession)
  }, [localHydrated, localSession, repository, runtime, writable])

  useEffect(() => {
    if (runtime || !localHydrated || writable || !canSync) return

    let active = true
    let loading = false

    const refresh = async () => {
      if (loading) return
      loading = true
      try {
        const remote = await repository.load()
        if (!active) return
        if (JSON.stringify(remote) !== JSON.stringify(localSessionRef.current)) {
          localSessionRef.current = remote
          setLocalSession(remote)
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
  }, [canSync, localHydrated, repository, runtime, writable])

  useEffect(() => {
    if (!runtime || runtime.role !== "MASTER" || runtime.status !== "connected") return
    if (!localHydrated || !runtime.initiativeState || runtime.initiativeState.initialized) return
    runtime.initializeInitiative(localSessionRef.current)
  }, [localHydrated, runtime])

  const updateSession = useCallback(
    (action: SetStateAction<InitiativeSession>) => {
      if (!writable) return
      if (!runtime) {
        setLocalSession(action)
        return
      }
      if (!runtime.initiativeState?.initialized) return

      const current = normalizeInitiativeSession(runtime.initiativeState.session)
      const next = typeof action === "function"
        ? action(current)
        : action
      const operation = inferInitiativeOperation(current, next)
      if (!operation) return
      runtime.dispatchInitiativeOperation(operation)
    },
    [runtime, writable],
  )

  const resetSession = useCallback(async () => {
    if (!writable) return
    if (runtime) {
      if (!runtime.initiativeState?.initialized) return
      runtime.dispatchInitiativeOperation({ type: "initiative.reset", characterId: "session" })
      return
    }
    const emptySession = await repository.clear()
    localSessionRef.current = emptySession
    setLocalSession(emptySession)
    setLocalHydrated(true)
  }, [repository, runtime, writable])

  const hydrated = runtime
    ? runtime.initiativeState !== null && (runtime.initiativeState.initialized || (runtime.role === "MASTER" && localHydrated))
    : localHydrated

  return {
    session,
    updateSession,
    resetSession,
    hydrated,
    readOnly: !writable,
  }
}

function inferInitiativeOperation(
  current: InitiativeSession,
  next: InitiativeSession,
): SessionInitiativeOperation | null {
  if (current.started !== next.started) {
    return {
      type: next.started ? "initiative.combat.start" : "initiative.combat.end",
      characterId: "session",
    }
  }

  const currentIds = new Set(current.entries.map((entry) => entry.id))
  const additions = next.entries.filter((entry) => !currentIds.has(entry.id))
  if (additions.length) {
    return {
      type: "initiative.entries.add",
      characterId: "session",
      entries: additions.map(toAddPayload),
    }
  }

  const nextIds = new Set(next.entries.map((entry) => entry.id))
  const removed = current.entries.find((entry) => !nextIds.has(entry.id))
  if (removed) {
    return { type: "initiative.entry.remove", characterId: "session", entryId: removed.id }
  }

  if (current.viewMode !== next.viewMode) {
    return { type: "initiative.viewMode.set", characterId: "session", viewMode: next.viewMode }
  }

  if (current.started && current.activeEntryId !== next.activeEntryId) {
    const currentIndex = current.entries.findIndex((entry) => entry.id === current.activeEntryId)
    if (currentIndex >= 0 && current.entries.length) {
      const nextId = current.entries[(currentIndex + 1) % current.entries.length]?.id
      const previousId = current.entries[(currentIndex - 1 + current.entries.length) % current.entries.length]?.id
      if (next.activeEntryId === nextId) return { type: "initiative.turn.next", characterId: "session" }
      if (next.activeEntryId === previousId) return { type: "initiative.turn.previous", characterId: "session" }
    }
  }

  const orderChanged = current.entries.some((entry, index) => entry.id !== next.entries[index]?.id)
  if (orderChanged) {
    const swapIndex = current.entries.findIndex((entry, index) => entry.id !== next.entries[index]?.id)
    if (
      swapIndex >= 0
      && next.entries[swapIndex]?.id === current.entries[swapIndex + 1]?.id
      && next.entries[swapIndex + 1]?.id === current.entries[swapIndex]?.id
    ) {
      return {
        type: "initiative.allies.trade",
        characterId: "session",
        entryId: current.entries[swapIndex].id,
        direction: 1,
      }
    }
    if (!current.started) return { type: "initiative.sort", characterId: "session" }
  }

  for (const entry of current.entries) {
    const nextEntry = next.entries.find((candidate) => candidate.id === entry.id)
    if (!nextEntry) continue
    const patch = diffEntry(entry, nextEntry)
    if (Object.keys(patch).length) {
      return {
        type: "initiative.entry.update",
        characterId: "session",
        entryId: entry.id,
        patch,
      }
    }
  }

  return null
}

function toAddPayload(entry: InitiativeEntry): Record<string, unknown> {
  const { id: _id, order: _order, createdAt: _createdAt, ...payload } = entry
  return payload
}

function diffEntry(current: InitiativeEntry, next: InitiativeEntry): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of [
    "name",
    "initiative",
    "initiativeBonus",
    "dexterity",
    "side",
    "armorClass",
    "currentHp",
    "maxHp",
    "temporaryHp",
    "hidden",
    "defeated",
  ] as const) {
    if (current[key] !== next[key]) patch[key] = next[key]
  }
  if (JSON.stringify(current.conditions) !== JSON.stringify(next.conditions)) {
    patch.conditions = next.conditions
  }
  return patch
}
