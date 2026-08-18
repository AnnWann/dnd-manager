import { createContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { SessionSocket, type SessionRuntimeStatus } from "./sessionSocket"
import type { SessionRuntimePresenceUser, SessionRuntimeRole } from "./sessionProtocol"

export type SessionRuntimeContextValue = {
  status: SessionRuntimeStatus
  sessionId: string
  clientId: string
  presence: SessionRuntimePresenceUser[]
  lastHeartbeatAckAt: number | null
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

  if (import.meta.env.DEV) {
    return "http://localhost:8787"
  }

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
  const clientId = useMemo(() => getOrCreateClientId(sessionId), [sessionId])
  const baseUrl = resolveSessionServerUrl()

  useEffect(() => {
    setPresence([])
    setLastHeartbeatAckAt(null)

    if (!baseUrl) {
      console.warn("[session-runtime] VITE_SESSION_SERVER_URL is not configured; realtime session runtime is disabled.")
      setStatus("disconnected")
      return
    }

    console.info("[session-runtime] connecting", {
      baseUrl,
      sessionId,
      userId,
      role,
      clientId,
    })

    const socket = new SessionSocket({
      baseUrl,
      sessionId,
      userId,
      role,
      clientId,
      onStatusChange: (nextStatus) => {
        console.info("[session-runtime] status", nextStatus)
        setStatus(nextStatus)
      },
      onMessage: (message) => {
        console.debug("[session-runtime] message", message)

        if (message.type === "session.presence") {
          setPresence(message.users)
          return
        }

        if (message.type === "session.heartbeat.ack") {
          setLastHeartbeatAckAt(Date.now())
          return
        }

        if (message.type === "session.error") {
          console.error(`[session-runtime] ${message.code}: ${message.message}`)
        }
      },
    })

    socket.connect()
    return () => socket.disconnect()
  }, [baseUrl, clientId, role, sessionId, userId])

  const value = useMemo<SessionRuntimeContextValue>(() => ({
    status,
    sessionId,
    clientId,
    presence,
    lastHeartbeatAckAt,
  }), [clientId, lastHeartbeatAckAt, presence, sessionId, status])

  return (
    <SessionRuntimeContext.Provider value={value}>
      {children}
    </SessionRuntimeContext.Provider>
  )
}
