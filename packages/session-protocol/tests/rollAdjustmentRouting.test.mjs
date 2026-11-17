import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

const built = await build({
  stdin: { contents: `
    export { SessionActor as CoreActor } from "./apps/session-server/src/routes/session/SessionActor";
    export { SessionActor as DeployedActor } from "./apps/session-server/src/routes/index";
    export { parseClientSessionMessage } from "./apps/session-server/src/routes/session/protocol";
    export { broadcastRollResult } from "./apps/session-server/src/routes/session/rollAdjustment";
    export { RollResultValue, nextRollMode } from "./apps/web/src/features/session/RollResultValue";
  `, loader: "tsx", resolveDir: fileURLToPath(new URL("../../../", import.meta.url)) },
  bundle: true, platform: "node", format: "esm", jsx: "automatic", write: false,
  plugins: [{ name: "workers", setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "workers" }))
    b.onLoad({ filter: /.*/, namespace: "workers" }, () => ({ contents: "export class DurableObject { constructor(ctx) { this.ctx = ctx } }" }))
  }}],
})
const { CoreActor, DeployedActor, parseClientSessionMessage, broadcastRollResult, RollResultValue, nextRollMode } =
  await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
const request = { rollId: "roll", target: "attack", mode: "advantage" }
test("the main protocol accepts roll adjustments and rejects malformed adjustments", () => {
  assert.equal(parseClientSessionMessage(JSON.stringify({ type: "session.roll.adjust", request })).request.mode, "advantage")
  assert.equal(parseClientSessionMessage(JSON.stringify({ type: "session.roll.adjust", request: { ...request, mode: "bad" } })), null)
  assert.equal(parseClientSessionMessage(JSON.stringify({ type: "session.roll.adjust", request: { ...request, target: { toString: null } } })), null)
})
for (const Actor of [CoreActor, DeployedActor]) {
  test(Actor === CoreActor ? "base websocket route handles adjustments" : "deployed websocket route handles adjustments", async () => {
    const data = new Map()
    const storage = {
      get: async key => structuredClone(data.get(key)),
      put: async (key,value) => { if (typeof key === "string") data.set(key,structuredClone(value)); else for (const [k,v] of Object.entries(key)) data.set(k,structuredClone(v)) },
      delete: async key => data.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {},
    }
    storage.transaction = async callback => callback(storage)
    let connection = { role: "MASTER", userId: "dm", clientId: "client", lastHeartbeatAt: Date.now() }
    const socket = { messages: [], deserializeAttachment: () => connection, serializeAttachment: value => { connection=value }, send(raw) { this.messages.push(JSON.parse(raw)) } }
    const actor = new Actor({ storage, getWebSockets: () => [socket] })
    await broadcastRollResult(storage, [socket], { type: "session.action.result", result: {
      id: "roll", requestId: "r", actorId: "dm", characterId: "creature:npc", sourceType: "creature",
      title: "Ataque", critical: false, createdAt: new Date().toISOString(),
      attack: { mode: "normal", groups: [{quantity:1,sides:20,rolls:[8],kept:8}], natural:8,modifier:3,total:11 },
    } })
    await actor.webSocketMessage(socket, JSON.stringify({ type: "session.roll.adjust", request }))
    assert.equal(socket.messages.some(message => message.type === "session.error"), false)
    assert.equal(socket.messages.at(-1).result.attack.mode, "advantage")
    assert.equal(socket.messages.at(-1).result.id, "roll")
    connection.role = "PLAYER"
    await actor.webSocketMessage(socket, JSON.stringify({ type: "session.roll.adjust", request }))
    assert.equal(socket.messages.at(-1).code, "ROLL_ADJUST_FAILED")
  })
}
test("clicking result cycles modes and clicking damage toggles critical without a menu", () => {
  assert.equal(nextRollMode("normal"), "advantage")
  assert.equal(nextRollMode("advantage"), "disadvantage")
  assert.equal(nextRollMode("disadvantage"), "normal")
  const sent = []
  const button = RollResultValue({ children: 11, adjustment: request, onAdjust: value => sent.push(value) })
  assert.equal(button.type, "button")
  button.props.onClick()
  assert.deepEqual(sent, [request])
  const damage = RollResultValue({ children: 5, adjustment: { rollId: "roll", target: "damage", critical: true }, onAdjust: value => sent.push(value) })
  damage.props.onClick()
  assert.equal(sent[1].critical, true)
  assert.equal(RollResultValue({ children: 11 }).type, "span")
})
