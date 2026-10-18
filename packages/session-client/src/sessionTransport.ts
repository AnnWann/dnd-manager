/** Browser-compatible WebSocket transport shared between application frontends.
 * Message decoding and game-specific state projections stay in the host adapter.
 */
export type SessionTransportStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error"
export type SessionTransportRole = "MASTER" | "PLAYER"
export type SessionTransportOptions = {
  baseUrl: string
  sessionId: string
  userId: string
  role: SessionTransportRole
  clientId: string
  useTokenAuth: boolean
  tokenEndpoint: string
  onStatusChange: (status: SessionTransportStatus) => void
  onMessage: (raw: string) => void
  onKicked: () => void
  onDisconnected?: () => void
}
const HEARTBEAT_MIN_MS = 27_000
const HEARTBEAT_MAX_MS = 33_000
const RECONNECT_MAX_MS = 10_000
const SESSION_KICKED_CLOSE_CODE = 4002

export class SessionTransport {
  private socket: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private connectionAttempt = 0
  private stopped = false
  private hasConnectedOnce = false

  constructor(private readonly options: SessionTransportOptions) {}

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  connect(): void {
    this.stopped = false
    this.clearReconnectTimer()
    void this.openSocket()
  }

  sendRaw(raw: string): boolean {
    if (!this.connected) return false
    this.socket!.send(raw)
    return true
  }

  disconnect(): void {
    this.stopped = true
    this.connectionAttempt++
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
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
      // Session readiness is delivered in-band before the first heartbeat.
      try {
        const packet = JSON.parse(event.data) as { type?: string }
        if (packet?.type === "session.ready") {
          this.hasConnectedOnce = true
          this.reconnectAttempt = 0
          this.options.onStatusChange("connected")
          this.scheduleHeartbeat()
        }
      } catch { /* Decoder in the host adapter handles malformed messages. */ }
      this.options.onMessage(event.data)
    }
    socket.onclose = (event) => {
      if (this.socket !== socket) return
      this.socket = null
      this.clearHeartbeatTimer()
      if (event.code === SESSION_KICKED_CLOSE_CODE) {
        this.stopped = true
        this.connectionAttempt++
        this.clearReconnectTimer()
        this.options.onDisconnected?.()
        this.options.onStatusChange("disconnected")
        this.options.onKicked()
        return
      }
      if (!this.stopped) this.scheduleReconnect()
    }
    socket.onerror = () => {
      if (!this.stopped) this.options.onStatusChange("error")
    }
  }

  private async buildUrl(): Promise<string> {
    const url = new URL(this.options.baseUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = `/session/${encodeURIComponent(this.options.sessionId)}/connect`
    url.search = ""
    if (this.options.useTokenAuth) {
      url.searchParams.set("token", await this.requestConnectionToken())
    } else {
      url.searchParams.set("userId", this.options.userId)
      url.searchParams.set("role", this.options.role)
      url.searchParams.set("clientId", this.options.clientId)
    }
    return url.toString()
  }

  private async requestConnectionToken(): Promise<string> {
    const response = await fetch(this.options.tokenEndpoint, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.options.sessionId, clientId: this.options.clientId }),
    })
    if (!response.ok) throw new Error(`Session connection token request failed with HTTP ${response.status}.`)
    const payload = await response.json() as { token?: unknown; expiresAt?: unknown; role?: unknown }
    if (typeof payload.token !== "string" || !payload.token || typeof payload.expiresAt !== "number"
      || (payload.role !== "MASTER" && payload.role !== "PLAYER")) {
      throw new Error("Session connection token response is invalid.")
    }
    return payload.token
  }

  private scheduleHeartbeat(): void {
    this.clearHeartbeatTimer()
    const delay = HEARTBEAT_MIN_MS + Math.floor(Math.random() * (HEARTBEAT_MAX_MS - HEARTBEAT_MIN_MS + 1))
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null
      if (!this.connected) return
      this.sendRaw(JSON.stringify({ type: "session.heartbeat", clientId: this.options.clientId }))
      this.scheduleHeartbeat()
    }, delay)
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.options.onStatusChange("reconnecting")
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.openSocket()
    }, delay)
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer === null) return
    clearTimeout(this.heartbeatTimer)
    this.heartbeatTimer = null
  }
  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }
}
