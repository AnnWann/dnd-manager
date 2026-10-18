import test from "node:test"
import assert from "node:assert/strict"
import { SessionMessageClient } from "../src/sessionMessageClient.ts"

const originalWebSocket = globalThis.WebSocket
const originalFetch = globalThis.fetch

class FakeWebSocket {
  static OPEN = 1
  static CLOSING = 2
  static instances = []
  readyState = 0
  sent = []
  constructor(url) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  send(payload) { this.sent.push(payload) }
  close(code) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  receive(data) { this.onmessage?.({ data }) }
  kick() { this.onclose?.({ code: 4002 }) }
}

function createClient(overrides = {}) {
  const statuses = [], received = [], kicked = []
  const client = new SessionMessageClient({
    baseUrl: "https://example.test",
    sessionId: "session-1",
    userId: "player-1",
    role: "PLAYER",
    clientId: "client-1",
    useTokenAuth: false,
    tokenEndpoint: "/api/session-connection",
    onStatusChange: (status) => statuses.push(status),
    onKicked: () => kicked.push(true),
    ...overrides,
  }, (raw) => {
    try {
      const packet = JSON.parse(raw)
      return packet.type === "event" ? packet : null
    } catch {
      return null
    }
  }, (value) => received.push(value))
  return { client, statuses, received, kicked }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))

test("typed messages decode, malformed packets drop and send respects readiness", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  try {
    const { client, statuses, received } = createClient()
    assert.equal(client.send({ type: "hello" }), false)
    client.connect()
    await tick()
    const socket = FakeWebSocket.instances.at(-1)
    assert.equal(new URL(socket.url).protocol, "wss:")
    socket.readyState = FakeWebSocket.OPEN
    socket.receive('{"type":"session.ready"}')
    assert.equal(client.connected, true)
    assert.equal(statuses.at(-1), "connected")
    socket.receive("malformed")
    socket.receive('{"type":"ignored"}')
    socket.receive('{"type":"event","value":3}')
    assert.deepEqual(received, [{ type: "event", value: 3 }])
    assert.equal(client.send({ type: "hello" }), true)
    assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: "hello" })
    client.disconnect()
    assert.equal(client.connected, false)
    assert.equal(statuses.at(-1), "disconnected")
  } finally { globalThis.WebSocket = originalWebSocket }
})

test("token authentication uses the host endpoint without URL identity fields", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  const requests = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init })
    return { ok: true, json: async () => ({ token: "signed-token", expiresAt: 99999999, role: "PLAYER" }) }
  }
  try {
    const { client } = createClient({ useTokenAuth: true })
    client.connect()
    await tick()
    const url = new URL(FakeWebSocket.instances.at(-1).url)
    assert.equal(url.searchParams.get("token"), "signed-token")
    assert.equal(url.searchParams.has("userId"), false)
    assert.equal(requests[0].init.credentials, "include")
    assert.deepEqual(JSON.parse(requests[0].init.body), { sessionId: "session-1", clientId: "client-1" })
    client.disconnect()
  } finally { globalThis.WebSocket = originalWebSocket; globalThis.fetch = originalFetch }
})

test("kicked connection clears state and does not reconnect", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  try {
    const { client, kicked, statuses } = createClient()
    client.connect()
    await tick()
    const socket = FakeWebSocket.instances.at(-1)
    socket.readyState = FakeWebSocket.OPEN
    socket.receive('{"type":"session.ready"}')
    socket.kick()
    assert.equal(client.connected, false)
    assert.deepEqual(kicked, [true])
    assert.equal(statuses.at(-1), "disconnected")
    client.disconnect()
  } finally { globalThis.WebSocket = originalWebSocket }
})

test("reconnects after an unexpected close and ignores a stale socket", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const scheduled = new Map()
  let sequence = 0
  globalThis.setTimeout = (callback, delay) => {
    const id = ++sequence
    scheduled.set(id, { callback, delay })
    return id
  }
  globalThis.clearTimeout = (id) => scheduled.delete(id)
  try {
    const { client, statuses, received } = createClient()
    client.connect()
    await tick()
    const first = FakeWebSocket.instances.at(-1)
    first.readyState = FakeWebSocket.OPEN
    first.receive('{"type":"session.ready"}')
    first.close(1006)
    assert.equal(statuses.at(-1), "reconnecting")
    const retry = [...scheduled.values()].find((timer) => timer.delay === 1000)
    assert.ok(retry, "first reconnect uses one-second backoff")
    for (const [id, timer] of scheduled) {
      if (timer === retry) { scheduled.delete(id); break }
    }
    retry.callback()
    await tick()
    const second = FakeWebSocket.instances.at(-1)
    assert.notEqual(second, first)
    // A delayed packet on the superseded connection must not mutate session data.
    first.receive('{"type":"event","value":"stale"}')
    second.readyState = FakeWebSocket.OPEN
    second.receive('{"type":"session.ready"}')
    second.receive('{"type":"event","value":"current"}')
    assert.deepEqual(received, [{ type: "event", value: "current" }])
    client.disconnect()
    assert.equal(scheduled.size, 0)
  } finally {
    globalThis.WebSocket = originalWebSocket
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test("an older delayed authorization cannot create a stale socket", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  let releaseFirst
  let authorizations = 0
  try {
    const { client } = createClient({
      useTokenAuth: true,
      getConnectionToken: () => ++authorizations === 1
        ? new Promise((resolve) => { releaseFirst = resolve })
        : Promise.resolve("second-token"),
    })
    client.connect()
    await tick()
    client.connect()
    await tick()
    assert.equal(FakeWebSocket.instances.length, 1)
    assert.equal(new URL(FakeWebSocket.instances[0].url).searchParams.get("token"), "second-token")
    releaseFirst("obsolete-token")
    await tick()
    assert.equal(FakeWebSocket.instances.length, 1)
    client.disconnect()
  } finally { globalThis.WebSocket = originalWebSocket }
})

test("manual reconnect replaces the active socket and ignores late errors", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  try {
    const { client, statuses, received } = createClient()
    client.connect()
    await tick()
    const original = FakeWebSocket.instances.at(-1)
    original.readyState = FakeWebSocket.OPEN
    original.receive('{"type":"session.ready"}')
    client.connect()
    await tick()
    const replacement = FakeWebSocket.instances.at(-1)
    assert.notEqual(replacement, original)
    original.onerror?.()
    original.receive('{"type":"event","value":"obsolete"}')
    assert.notEqual(statuses.at(-1), "error")
    replacement.readyState = FakeWebSocket.OPEN
    replacement.receive('{"type":"session.ready"}')
    replacement.receive('{"type":"event","value":"latest"}')
    assert.deepEqual(received, [{ type: "event", value: "latest" }])
    client.disconnect()
  } finally { globalThis.WebSocket = originalWebSocket }
})

test("heartbeat starts only after ready and stops on disconnect", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = new Map()
  let id = 0
  globalThis.setTimeout = (fn, delay) => {
    const next = ++id
    timers.set(next, { fn, delay })
    return next
  }
  globalThis.clearTimeout = (key) => timers.delete(key)
  try {
    const { client } = createClient()
    client.connect()
    await tick()
    const socket = FakeWebSocket.instances.at(-1)
    assert.equal(timers.size, 0, "no heartbeat before ready")
    socket.readyState = FakeWebSocket.OPEN
    socket.receive('{"type":"session.ready"}')
    const heartbeat = [...timers.entries()].find(([, timer]) => timer.delay >= 27000 && timer.delay <= 33000)
    assert.ok(heartbeat)
    timers.delete(heartbeat[0])
    heartbeat[1].fn()
    assert.deepEqual(JSON.parse(socket.sent.at(-1)), { type: "session.heartbeat", clientId: "client-1" })
    assert.equal(timers.size, 1, "heartbeat rescheduled")
    client.disconnect()
    assert.equal(timers.size, 0, "disconnect cancels heartbeat")
  } finally {
    globalThis.WebSocket = originalWebSocket
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test("authorization failures schedule a reconnect without opening a socket", async () => {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const originalError = console.error
  const timers = new Map()
  let id = 0
  globalThis.setTimeout = (fn, delay) => {
    const next = ++id
    timers.set(next, { fn, delay })
    return next
  }
  globalThis.clearTimeout = (key) => timers.delete(key)
  console.error = () => {}
  try {
    const { client, statuses } = createClient({
      useTokenAuth: true,
      getConnectionToken: async () => { throw new Error("token denied") },
    })
    client.connect()
    await tick()
    assert.equal(FakeWebSocket.instances.length, 0)
    assert.ok(statuses.includes("error"))
    assert.equal(statuses.at(-1), "reconnecting")
    assert.ok([...timers.values()].some((timer) => timer.delay === 1000))
    client.disconnect()
    assert.equal(timers.size, 0)
  } finally {
    globalThis.WebSocket = originalWebSocket
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    console.error = originalError
  }
})
