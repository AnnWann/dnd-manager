import {
  parseServerSessionMessage,
  type ClientSessionMessage,
  type ServerSessionMessage,
  type SessionRuntimeRole,
} from "./sessionProtocol"
import {
  parseAbilityServerMessage,
  type SessionAbilityClientMessage,
  type SessionAbilityServerMessage,
} from "./abilitySessionProtocol"
import type { SessionMagicOperation } from "./magicSessionProtocol"
import type { SessionEquipmentOperation } from "./equipmentSessionProtocol"
import type { SessionProficiencyClientMessage } from "./proficiencySessionProtocol"
import type { SessionRaceClientMessage } from "./raceSessionProtocol"
import type { SessionProfileClientMessage } from "./profileSessionProtocol"
import type { SessionCustomClassClientMessage } from "./customClassSessionProtocol"
import type { SessionCustomSystemClientMessage } from "./customSystemSessionProtocol"
import {
  parseCharacterLifecycleServerMessage,
  type SessionCharacterLifecycleClientMessage,
  type SessionCharacterLifecycleServerMessage,
} from "./characterLifecycleSessionProtocol"
import type {
  SessionInventoryClientMessage,
  SessionInventoryServerMessage,
} from "./inventorySessionProtocol"
import {
  parseMissionServerMessage,
  type SessionMissionClientMessage,
  type SessionMissionServerMessage,
} from "./missionSessionProtocol"
import {
  parseInitiativeServerMessage,
  type SessionInitiativeClientMessage,
  type SessionInitiativeServerMessage,
} from "./initiativeSessionProtocol"
import {
  parseRuntimeConfigServerMessage,
  type SessionRuntimeConfigClientMessage,
  type SessionRuntimeConfigServerMessage,
} from "./runtimeConfigSessionProtocol"
import type { SessionSheetOperationMessage } from "./sheetRoutes"

export type SessionRuntimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

export type SessionSocketOptions = {
  baseUrl: string
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  clientId: string
  onStatusChange: (status: SessionRuntimeStatus) => void
  onMessage: (
    message:
      | ServerSessionMessage
      | SessionAbilityServerMessage
      | SessionInventoryServerMessage
      | SessionCharacterLifecycleServerMessage
      | SessionMissionServerMessage
      | SessionInitiativeServerMessage
      | SessionRuntimeConfigServerMessage
  ) => void
}

type SessionConnectionTokenResponse = {
  token: string
  expiresAt: number
  role: SessionRuntimeRole
}

const HEARTBEAT_MIN_MS = 27_000
const HEARTBEAT_MAX_MS = 33_000
const RECONNECT_MAX_MS = 10_000

export class SessionSocket {
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private connectionAttempt = 0
  private stopped = false
  private hasConnectedOnce = false
  private pendingMagicOperations: SessionMagicOperation[] = []
  private magicFlushQueued = false

  constructor(private readonly options: SessionSocketOptions) {}

  connect(): void {
    this.stopped = false
    this.clearReconnectTimer()
    void this.openSocket()
  }

  send(message:
    | ClientSessionMessage
    | SessionSheetOperationMessage
    | SessionAbilityClientMessage
    | SessionInventoryClientMessage
    | SessionMissionClientMessage
    | SessionInitiativeClientMessage
    | SessionProficiencyClientMessage
    | SessionRaceClientMessage
    | SessionProfileClientMessage
    | SessionCustomClassClientMessage
    | SessionCharacterLifecycleClientMessage
    | SessionRuntimeConfigClientMessage
    | SessionCustomSystemClientMessage
    | { type: "session.magic.operation"; operation: SessionMagicOperation }
    | { type: "session.equipment.operation"; operation: SessionEquipmentOperation }
  ): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false

    if (message.type === "session.magic.operation") {
      this.pendingMagicOperations.push(message.operation)
      this.scheduleMagicFlush()
      return true
    }

    this.socket.send(JSON.stringify(message))
    return true
  }

  disconnect(): void {
    this.stopped = true
    this.connectionAttempt += 1
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
    this.pendingMagicOperations = []
    this.magicFlushQueued = false
    const socket = this.socket
    this.socket = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Session runtime disconnected")
    this.options.onStatusChange("disconnected")
  }

  private async openSocket(): Promise<void> {
    if (this.stopped) return
    const attempt = ++this.connectionAttempt
    this.options.onStatusChange(this.hasConnectedOnce ? "reconnecting" : "connecting")

    let socketUrl: string
    try {
      socketUrl = await this.buildUrl()
    } catch (error) {
      if (this.stopped || attempt !== this.connectionAttempt) return
      console.error("[session-runtime] failed to authorize websocket connection", error)
      this.options.onStatusChange("error")
      this.scheduleReconnect()
      return
    }

    if (this.stopped || attempt !== this.connectionAttempt) return

    let socket: WebSocket
    try {
      socket = new WebSocket(socketUrl)
    } catch (error) {
      console.error("[session-runtime] failed to open websocket connection", error)
      this.options.onStatusChange("error")
      this.scheduleReconnect()
      return
    }

    this.socket = socket

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return
      const runtimeConfigMessage = parseRuntimeConfigServerMessage(event.data)
      const lifecycleMessage = parseCharacterLifecycleServerMessage(event.data)
      const inventoryMessage = parseInventoryServerMessage(event.data)
      const missionMessage = parseMissionServerMessage(event.data)
      const initiativeMessage = parseInitiativeServerMessage(event.data)
      const message = runtimeConfigMessage ?? lifecycleMessage ?? inventoryMessage ?? missionMessage ?? initiativeMessage ?? parseAbilityServerMessage(event.data) ?? parseServerSessionMessage(event.data)
      if (!message) return
      if (message.type === "session.ready") {
        this.hasConnectedOnce = true
        this.reconnectAttempt = 0
        this.options.onStatusChange("connected")
        this.scheduleHeartbeat()
      }
      this.options.onMessage(message)
    }

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null
      this.clearHeartbeatTimer()
      if (!this.stopped) this.scheduleReconnect()
    }
    socket.onerror = () => {
      if (!this.stopped) this.options.onStatusChange("error")
    }
  }

  private scheduleMagicFlush(): void {
    if (this.magicFlushQueued) return
    this.magicFlushQueued = true

    queueMicrotask(() => {
      this.magicFlushQueued = false
      const socket = this.socket
      const pending = this.pendingMagicOperations.splice(0)
      if (!pending.length || socket?.readyState !== WebSocket.OPEN) return

      const byCharacter = new Map<string, SessionMagicOperation[]>()
      for (const operation of pending) {
        const group = byCharacter.get(operation.characterId)
        if (group) group.push(operation)
        else byCharacter.set(operation.characterId, [operation])
      }

      for (const operations of byCharacter.values()) {
        const payload = operations.length === 1
          ? { type: "session.magic.operation", operation: operations[0] }
          : { type: "session.magic.operations", operations }
        socket.send(JSON.stringify(payload))
      }
    })
  }

  private async buildUrl(): Promise<string> {
    const url = new URL(this.options.baseUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = `/session/${encodeURIComponent(this.options.sessionId)}/connect`
    url.search = ""

    if (this.usesTokenAuth()) {
      url.searchParams.set("token", await this.requestConnectionToken())
    } else {
      url.searchParams.set("userId", this.options.userId)
      url.searchParams.set("role", this.options.role)
      url.searchParams.set("clientId", this.options.clientId)
    }

    return url.toString()
  }

  private usesTokenAuth(): boolean {
    const configured = import.meta.env.VITE_SESSION_AUTH_MODE?.trim().toLowerCase()
    if (configured === "token") return true
    if (configured === "development") return false
    return !import.meta.env.DEV
  }

  private async requestConnectionToken(): Promise<string> {
    const response = await fetch("/api/session-connection", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: this.options.sessionId,
        clientId: this.options.clientId,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Session connection token request failed with HTTP ${response.status}.`,
      )
    }

    const payload = await response.json() as Partial<SessionConnectionTokenResponse>
    if (
      typeof payload.token !== "string" ||
      !payload.token ||
      typeof payload.expiresAt !== "number" ||
      (payload.role !== "MASTER" && payload.role !== "PLAYER")
    ) {
      throw new Error("Session connection token response is invalid.")
    }

    return payload.token
  }

  private scheduleHeartbeat(): void {
    this.clearHeartbeatTimer()
    const delay = HEARTBEAT_MIN_MS + Math.floor(Math.random() * (HEARTBEAT_MAX_MS - HEARTBEAT_MIN_MS + 1))
    this.heartbeatTimer = window.setTimeout(() => {
      this.heartbeatTimer = null
      if (this.socket?.readyState !== WebSocket.OPEN) return
      this.socket.send(JSON.stringify({ type: "session.heartbeat", clientId: this.options.clientId }))
      this.scheduleHeartbeat()
    }, delay)
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.options.onStatusChange("reconnecting")
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocket()
    }, delay)
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer === null) return
    window.clearTimeout(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return
    window.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }
}

function parseInventoryServerMessage(raw: string): SessionInventoryServerMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value?.type !== "session.inventory.snapshot" && value?.type !== "session.inventory.updated") return null
    if (!value.state || typeof value.state !== "object") return null
    return value as SessionInventoryServerMessage
  } catch {
    return null
  }
}