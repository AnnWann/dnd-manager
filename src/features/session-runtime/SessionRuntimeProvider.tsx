import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { SessionSocket, type SessionRuntimeStatus } from "./sessionSocket"
import { toSheetOperationMessage } from "./sheetRoutes"
import type {
  SessionAbilityOperation,
  SessionAbilitySeed,
  SessionAbilityState,
} from "./abilitySessionProtocol"
import type {
  SessionAuthoritativeOperation,
  SessionCondition,
  SessionConditionOperation,
  SessionConditionSeed,
  SessionConcentrationOperation,
  SessionConditionsState,
  SessionHpLogRecord,
  SessionHpSeed,
  SessionHpState,
  SessionLoggedOperation,
  SessionRuntimePresenceUser,
  SessionRuntimeRole,
} from "./sessionProtocol"

const CONCENTRATION_TAG = "dnd-manager:concentrating"

export type SessionRuntimeContextValue = {
  status: SessionRuntimeStatus
  sessionId: string
  clientId: string
  role: SessionRuntimeRole
  presence: SessionRuntimePresenceUser[]
  lastHeartbeatAckAt: number | null
  hpByCharacterId: Readonly<Record<string, SessionHpState>>
  conditionsByCharacterId: Readonly<Record<string, SessionConditionsState>>
  abilitiesByCharacterId: Readonly<Record<string, SessionAbilityState>>
  hpLog: SessionHpLogRecord[]
  initializeHp: (characters: SessionHpSeed[]) => boolean
  initializeConditions: (characters: SessionConditionSeed[]) => boolean
  initializeAbilities: (characters: SessionAbilitySeed[]) => boolean
  dispatchSheetOperation: (operation: SessionLoggedOperation) => boolean
  dispatchHpOperation: (operation: SessionAuthoritativeOperation) => boolean
  dispatchConditionOperation: (operation: SessionConditionOperation) => boolean
  dispatchConcentrationOperation: (operation: SessionConcentrationOperation) => boolean
  dispatchAbilityOperation: (operation: SessionAbilityOperation) => boolean
  undoLog: (logId: string) => boolean
}

export const SessionRuntimeContext = createContext<SessionRuntimeContextValue | null>(null)

function getOrCreateClientId(sessionId: string): string {
  const key = `dnd-manager.session-runtime.client-id.${sessionId}`
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing

  const clientId = crypto.randomUUID()
  window.sessionStorage.setItem(key, clientId)
  return clientId
}

function resolveSessionServerUrl(): string {
  const configured = import.meta.env.VITE_SESSION_SERVER_URL?.trim()
  if (configured) return configured
  if (import.meta.env.DEV) return "http://localhost:8787"
  return ""
}

export function SessionRuntimeProvider(props: {
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  children: ReactNode
}) {
  const parent = useContext(SessionRuntimeContext)

  if (parent?.sessionId === props.sessionId) {
    return <>{props.children}</>
  }

  return <SessionRuntimeProviderInner {...props} />
}

function SessionRuntimeProviderInner({
  sessionId,
  userId,
  role,
  children,
}: {
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  children: ReactNode
}) {
  const [status, setStatus] = useState<SessionRuntimeStatus>("disconnected")
  const [presence, setPresence] = useState<SessionRuntimePresenceUser[]>([])
  const [lastHeartbeatAckAt, setLastHeartbeatAckAt] = useState<number | null>(null)
  const [hpByCharacterId, setHpByCharacterId] = useState<Record<string, SessionHpState>>({})
  const [conditionsByCharacterId, setConditionsByCharacterId] = useState<Record<string, SessionConditionsState>>({})
  const [abilitiesByCharacterId, setAbilitiesByCharacterId] = useState<Record<string, SessionAbilityState>>({})
  const [hpLog, setHpLog] = useState<SessionHpLogRecord[]>([])
  const socketRef = useRef<SessionSocket | null>(null)
  const clientId = useMemo(() => getOrCreateClientId(sessionId), [sessionId])
  const baseUrl = resolveSessionServerUrl()

  useEffect(() => {
    setPresence([])
    setLastHeartbeatAckAt(null)
    setHpByCharacterId({})
    setConditionsByCharacterId({})
    setAbilitiesByCharacterId({})
    setHpLog([])

    if (!baseUrl) {
      console.warn("[session-runtime] VITE_SESSION_SERVER_URL is not configured; realtime session runtime is disabled.")
      setStatus("disconnected")
      return
    }

    const socket = new SessionSocket({
      baseUrl,
      sessionId,
      userId,
      role,
      clientId,
      onStatusChange: setStatus,
      onMessage: (message) => {
        if (message.type === "session.presence") {
          setPresence(message.users)
          return
        }
        if (message.type === "session.heartbeat.ack") {
          setLastHeartbeatAckAt(Date.now())
          return
        }
        if (message.type === "session.hp.snapshot") {
          setHpByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.hp.updated") {
          setHpByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.conditions.snapshot") {
          setConditionsByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.conditions.updated") {
          setConditionsByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.abilities.snapshot") {
          setAbilitiesByCharacterId(Object.fromEntries(message.characters.map((character) => [character.characterId, character])))
          return
        }
        if (message.type === "session.abilities.updated") {
          setAbilitiesByCharacterId((current) => ({ ...current, [message.character.characterId]: message.character }))
          return
        }
        if (message.type === "session.hp.log") {
          setHpLog(message.records)
          return
        }
        if (message.type === "session.error") {
          console.error(`[session-runtime] ${message.code}: ${message.message}`)
        }
      },
    })

    socketRef.current = socket
    socket.connect()
    return () => {
      if (socketRef.current === socket) socketRef.current = null
      socket.disconnect()
    }
  }, [baseUrl, clientId, role, sessionId, userId])

  const initializeHp = useCallback((characters: SessionHpSeed[]) =>
    socketRef.current?.send({ type: "session.hp.initialize", characters }) ?? false,
  [])

  const initializeConditions = useCallback((characters: SessionConditionSeed[]) =>
    socketRef.current?.send({ type: "session.conditions.initialize", characters }) ?? false,
  [])

  const initializeAbilities = useCallback((characters: SessionAbilitySeed[]) =>
    socketRef.current?.send({ type: "session.abilities.initialize", characters }) ?? false,
  [])

  const dispatchSheetOperation = useCallback((operation: SessionLoggedOperation) =>
    socketRef.current?.send(toSheetOperationMessage(operation)) ?? false,
  [])

  const dispatchHpOperation = useCallback((operation: SessionAuthoritativeOperation) =>
    dispatchSheetOperation(operation),
  [dispatchSheetOperation])

  const dispatchConcentrationOperation = useCallback((operation: SessionConcentrationOperation) =>
    dispatchSheetOperation(operation),
  [dispatchSheetOperation])

  const dispatchAbilityOperation = useCallback((operation: SessionAbilityOperation) =>
    socketRef.current?.send({ type: "session.abilities.operation", operation }) ?? false,
  [])

  // Legacy condition call sites are translated here so the concentration condition
  // cannot bypass the dedicated concentration domain while those call sites migrate.
  const dispatchConditionOperation = useCallback((operation: SessionConditionOperation) => {
    if (operation.type === "character.condition.add" || operation.type === "character.condition.update") {
      if (isConcentrationCondition(operation.condition)) {
        return dispatchConcentrationOperation({
          type: "character.concentration.start",
          characterId: operation.characterId,
          spellIndex: concentrationSpellIndex(operation.condition),
          spellName: operation.condition.source.trim() || "Concentração",
        })
      }
    }

    if (operation.type === "character.condition.remove") {
      const condition = conditionsByCharacterId[operation.characterId]?.conditions.find(
        (entry) => entry.id === operation.conditionId,
      )
      if (condition && isConcentrationCondition(condition)) {
        return dispatchConcentrationOperation({
          type: "character.concentration.end",
          characterId: operation.characterId,
          reason: "manual",
        })
      }
    }

    return dispatchSheetOperation(operation)
  }, [conditionsByCharacterId, dispatchConcentrationOperation, dispatchSheetOperation])

  const undoLog = useCallback((logId: string) =>
    socketRef.current?.send({ type: "session.log.undo", logId }) ?? false,
  [])

  const value = useMemo<SessionRuntimeContextValue>(() => ({
    status,
    sessionId,
    clientId,
    role,
    presence,
    lastHeartbeatAckAt,
    hpByCharacterId,
    conditionsByCharacterId,
    abilitiesByCharacterId,
    hpLog,
    initializeHp,
    initializeConditions,
    initializeAbilities,
    dispatchSheetOperation,
    dispatchHpOperation,
    dispatchConditionOperation,
    dispatchConcentrationOperation,
    dispatchAbilityOperation,
    undoLog,
  }), [
    abilitiesByCharacterId,
    clientId,
    conditionsByCharacterId,
    dispatchAbilityOperation,
    dispatchConditionOperation,
    dispatchConcentrationOperation,
    dispatchHpOperation,
    dispatchSheetOperation,
    hpByCharacterId,
    hpLog,
    initializeAbilities,
    initializeConditions,
    initializeHp,
    lastHeartbeatAckAt,
    presence,
    role,
    sessionId,
    status,
    undoLog,
  ])

  return (
    <SessionRuntimeContext.Provider value={value}>
      {children}
    </SessionRuntimeContext.Provider>
  )
}

function isConcentrationCondition(condition: SessionCondition): boolean {
  return condition.tags.includes(CONCENTRATION_TAG) || normalize(condition.name) === "concentrando"
}

function concentrationSpellIndex(condition: SessionCondition): string {
  const notes = condition.notes.trim()
  return notes.startsWith("spell:") ? notes.slice("spell:".length).trim() || "unknown" : "unknown"
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
