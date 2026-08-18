import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { SessionSocket, type SessionRuntimeStatus } from "./sessionSocket"
import type {
  SessionHpLogRecord,
  SessionHpOperation,
  SessionHpSeed,
  SessionHpState,
  SessionRuntimePresenceUser,
  SessionRuntimeRole,
} from "./sessionProtocol"

export type SessionRuntimeContextValue = {
  status: SessionRuntimeStatus
  sessionId: string
  clientId: string
  role: SessionRuntimeRole
  presence: SessionRuntimePresenceUser[]
  lastHeartbeatAckAt: number | null
  hpByCharacterId: Readonly<Record<string, SessionHpState>>
  hpLog: SessionHpLogRecord[]
  initializeHp: (characters: SessionHpSeed[]) => boolean
  dispatchHpOperation: (operation: SessionHpOperation) => boolean
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

export function SessionRuntimeProvider({
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
  const [hpLog, setHpLog] = useState<SessionHpLogRecord[]>([])
  const socketRef = useRef<SessionSocket | null>(null)
  const clientId = useMemo(() => getOrCreateClientId(sessionId), [sessionId])
  const baseUrl = resolveSessionServerUrl()

  useEffect(() => {
    setPresence([])
    setLastHeartbeatAckAt(null)
    setHpByCharacterId({})
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
          setHpByCharacterId(Object.fromEntries(
            message.characters.map((character) => [character.characterId, character]),
          ))
          return
        }

        if (message.type === "session.hp.updated") {
          setHpByCharacterId((current) => ({
            ...current,
            [message.character.characterId]: message.character,
          }))
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

  const dispatchHpOperation = useCallback((operation: SessionHpOperation) =>
    socketRef.current?.send({ type: "session.hp.operation", operation }) ?? false,
  [])

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
    hpLog,
    initializeHp,
    dispatchHpOperation,
    undoLog,
  }), [
    clientId,
    dispatchHpOperation,
    hpByCharacterId,
    hpLog,
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
