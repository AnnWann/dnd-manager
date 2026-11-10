import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

async function load(path) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true, format: "esm", platform: "node", write: false,
    conditions: ["types"], define: { "import.meta.env": "{}" },
  })
  return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].contents).toString("base64"))
}

const web = "../../../apps/web/src/"
const server = "../../../apps/session-server/src/routes/"
const [
  { SessionSocket }, { projectSessionMutations }, { normalizeCharacterStateSeed },
  { handleTrackedSessionMutation, readTrackedMutation },
] = await Promise.all([
  load(web + "features/session-runtime/sessionSocket.ts"),
  load(web + "features/session-runtime/optimisticSessionMutation.ts"),
  load(server + "characters/sheet/characterState.ts"),
  load(server + "session/trackedSessionMutation.ts"),
])

const operation = { type: "character.hp.heal", characterId: "pc", amount: 2 }
const message = { type: "session.hp.operation", operation }

test("a rejected request returns its own code without consuming subsequent replies", async () => {
  const tracked = readTrackedMutation(JSON.stringify({ ...message, mutationId: "first" }))
  const replies = []
  await handleTrackedSessionMutation({ send: raw => replies.push(JSON.parse(raw)) }, tracked, async (socket, raw) => {
    assert.deepEqual(JSON.parse(raw), message)
    socket.send(JSON.stringify({ type: "session.error", code: "DENIED", message: "Recusado" }))
  })
  assert.deepEqual(replies, [{
    type: "session.mutation.result", requestId: "first", error: { code: "DENIED", message: "Recusado" },
  }])
})

test("snapshots and acknowledgements flush together and consecutive clicks keep their order", () => {
  const received = []
  const sent = []
  const socket = new SessionSocket({
    role: "MASTER", onMessage: message => received.push(message), onStatusChange() {},
  })
  socket.transport = {
    connected: true, sendRaw(raw) { sent.push(JSON.parse(raw)); return true },
  }
  const incoming = message => socket.handleMessage({
    message, abilityMessage: null, lifecycleMessage: null, runtimeConfigMessage: null,
  })
  socket.send(message, "first")
  socket.send(message, "second")
  assert.deepEqual(sent.map(entry => entry.mutationId), ["first"])
  const update = { type: "session.hp.updated", character: { characterId: "pc", current: 4 } }
  incoming(update)
  assert.deepEqual(received, [])
  incoming({ type: "session.mutation.result", requestId: "first" })
  assert.deepEqual(received.map(entry => entry.type), ["session.hp.updated", "session.mutation.result"])
  assert.deepEqual(sent.map(entry => entry.mutationId), ["first", "second"])
  const error = { code: "DENIED", message: "Recusado" }
  incoming({ type: "session.mutation.result", requestId: "second", error })
  assert.deepEqual(received.at(-1).error, error)
})

test("a rejected delta is removed without discarding a later pending delta", () => {
  const hp = { pc: normalizeCharacterStateSeed({ characterId: "pc", current: 2, max: 10, currentMax: 10, maxHpBonus: 0 }) }
  const pending = ["first", "second"].map(id => ({ id, operation: { domain: "sheet", value: operation } }))
  const project = pending => projectSessionMutations(hp, {}, null, pending, [], "owner")
  assert.equal(project(pending).hp.pc.current, 6)
  assert.equal(project(pending.slice(1)).hp.pc.current, 4)
  assert.equal(project([]).hp.pc.current, 2)
  assert.equal(hp.pc.current, 2)
})

test("spell slots and ability counters project together without changing confirmed data", async () => {
  const { CharacterTemplate } = await load(web + "models/characters/CharacterTemplate.ts")
  const character = CharacterTemplate.fromJSON({
    id: "pc",
    sheet: { classes: [{ className: "wizard", level: 1, spellcastingProgression: "full", castingAttribute: "int" }] },
    abilities: [{ id: "charges", name: "Cargas", kind: "active", usage: { max: 3, used: 0, reset: "longRest" } }],
  })
  const confirmed = { pc: { characterId: "pc", initialized: true, revision: 1, character: character.toJSON() } }
  const changes = [
    { type: "character.spellSlot.spend", characterId: "pc", level: 1 },
    { type: "character.ability.usage.spend", characterId: "pc", source: { type: "character", abilityId: "charges" } },
  ].map((value, index) => ({ id: String(index), operation: { domain: "character", value } }))
  const projected = projectSessionMutations({}, confirmed, null, changes, [], "owner")
  const next = CharacterTemplate.fromJSON(projected.abilities.pc.character)
  assert.equal(next.getSpellSlots()[1].current, character.getSpellSlots()[1].current - 1)
  assert.equal(next.get("abilities")[0].usage.used, 1)
  assert.equal(confirmed.pc.character.abilities[0].usage.used, 0)
})
