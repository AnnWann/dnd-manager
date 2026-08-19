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
import type {
  SessionInventoryClientMessage,
  SessionInventoryServerMessage,
} from "./inventorySessionProtocol"
import type { SessionSheetOperationMessage } from "./sheetRoutes"

export type SessionRuntimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"

export type SessionSocketOptions = {
  baseUrl: string
  sessionId: string
  userId: string
  role: SessionRuntimeRole
  clientId: string
  onStatusChange: (status: SessionRuntimeStatus) => void
  onMessage: (message: ServerSessionMessage | SessionAbilityServerMessage | SessionInventoryServerMessage) => void
}

const HEARTBEAT_MIN_MS = 27_000
const HEARTBEAT_MAX_MS = 33_000
const RECONNECT_MAX_MS = 10_000

export class SessionSocket {
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempt = 0
  private stopped = false
  private hasConnectedOnce = false

  constructor(private readonly options: SessionSocketOptions) {}

  connect(): void {
    this.stopped = false
    this.clearReconnectTimer()
    this.openSocket()
  }

  send(message:
    | ClientSessionMessage
    | SessionSheetOperationMessage
    | SessionAbilityClientMessage
    | SessionInventoryClientMessage
    | { type: "session.magic.operation"; operation: SessionMagicOperation }
    | { type: "session.equipment.operation"; operation: SessionEquipmentOperation }
  ): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify(message))
    return true
  }

  disconnect(): void {
    this.stopped = true
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
    const socket = this.socket
    this.socket = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Session runtime disconnected")
    this.options.onStatusChange("disconnected")
  }

  private openSocket(): void {
    if (this.stopped) return
    this.options.onStatusChange(this.hasConnectedOnce ? "reconnecting" : "connecting")
    const socket = new WebSocket(this.buildUrl())
    this.socket = socket

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return
      const inventoryMessage = parseInventoryServerMessage(event.data)
      const message = inventoryMessage ?? parseAbilityServerMessage(event.data) ?? parseServerSessionMessage(event.data)
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

  private buildUrl(): string {
    const url = new URL(this.options.baseUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = `/session/${encodeURIComponent(this.options.sessionId)}/connect`
    url.search = ""
    url.searchParams.set("userId", this.options.userId)
    url.searchParams.set("role", this.options.role)
    url.searchParams.set("clientId", this.options.clientId)
    return url.toString()
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
      this.openSocket()
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
