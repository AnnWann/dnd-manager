import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const entry = fileURLToPath(new URL("../../../apps/session-server/src/routes/session/rollAdjustment.ts", import.meta.url))
const built = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", target: "node24", write: false })
const { adjustStoredRoll, parseRollAdjustment, handleRollAdjustment, broadcastRollResult } =
  await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
const damage = () => ({ groups: [{ quantity: 1, sides: 6, rolls: [3] }], modifier: 2, total: 5, critical: false })
const action = () => ({
  type: "session.action.result", result: {
    id: "roll", requestId: "request", actorId: "player", characterId: "char", sourceType: "weapon",
    title: "Ataque", createdAt: "2026-11-15T10:00:00Z", visibility: "roller-master",
    attack: { mode: "normal", groups: [{ quantity: 1, sides: 20, rolls: [7], kept: 7 }], modifier: 4, natural: 7, total: 11 },
    damage: damage(), critical: false,
  },
})
const stored = (message = action()) => ({ message, original: structuredClone(message), variants: {} })
const request = changes => ({ rollId: "roll", target: "attack", ...changes })

test("advantage preserves the first die and reuses the second across mode changes", () => {
  const roll = stored()
  let rolls = 0
  const random = () => { rolls++; return 18 }
  adjustStoredRoll(roll, request({ mode: "advantage" }), undefined, random)
  assert.equal(roll.message.result.attack.total, 22)
  assert.deepEqual(roll.message.result.attack.groups[0].rolls, [7, 18])
  adjustStoredRoll(roll, request({ mode: "disadvantage" }), undefined, random)
  assert.equal(roll.message.result.attack.total, 11)
  adjustStoredRoll(roll, request({ mode: "normal" }), undefined, random)
  assert.deepEqual(roll.message.result.attack.groups[0].rolls, [7])
  adjustStoredRoll(roll, request({ mode: "advantage" }), undefined, random)
  assert.equal(rolls, 1)
  assert.equal(roll.message.result.id, "roll")
  assert.equal(roll.message.result.visibility, "roller-master")
})

test("critical adds only the extra dice, and can be undone without rerolling", () => {
  const roll = stored()
  let dice = 0
  const random = () => { dice++; return 4 }
  const critical = request({ target: "damage", damageIndex: 0, critical: true })
  adjustStoredRoll(roll, critical, undefined, random)
  assert.equal(roll.message.result.damage.total, 9)
  assert.deepEqual(roll.message.result.damage.groups[0].rolls, [3, 4])
  adjustStoredRoll(roll, { ...critical, critical: false }, undefined, random)
  assert.equal(roll.message.result.damage.total, 5)
  assert.equal(roll.message.result.critical, false)
  adjustStoredRoll(roll, critical, undefined, random)
  assert.equal(roll.message.result.damage.total, 9)
  assert.equal(dice, 1)
})

test("campaign critical formula applies only to the selected damage instance", () => {
  const message = action()
  delete message.result.damage
  message.result.instances = [{ label: "Primeiro", damages: [damage()] }, { label: "Segundo", damages: [damage()] }]
  const roll = stored(message)
  adjustStoredRoll(roll, request({ target: "damage", instanceIndex: 1, damageIndex: 0, critical: true }), { mode: "maximum" }, () => 1)
  assert.equal(roll.message.result.instances[0].damages[0].total, 5)
  assert.equal(roll.message.result.instances[1].damages[0].total, 11)
})

test("original critical can be removed using its preserved normal damage", () => {
  const message = action()
  message.result.damage = { ...damage(), groups: [{ quantity: 2, sides: 6, rolls: [3, 6] }], total: 11, critical: true,
    normalDamage: { groups: [{ quantity: 1, sides: 6, rolls: [3] }], modifier: 2, total: 5 } }
  const roll = stored(message)
  adjustStoredRoll(roll, request({ target: "damage", critical: false }))
  assert.equal(roll.message.result.damage.total, 5)
  adjustStoredRoll(roll, request({ target: "damage", critical: true }))
  assert.equal(roll.message.result.damage.total, 11)
})

test("invalid targets, healing and non-d20 rolls cannot be adjusted", () => {
  assert.equal(parseRollAdjustment({ rollId: "r", target: "attack", mode: "arbitrary" }), null)
  assert.equal(parseRollAdjustment({ rollId: "r", target: "damage", critical: true, damageIndex: -1 }), null)
  assert.throws(() => adjustStoredRoll(stored(), request({ mode: "normal", instanceIndex: 12 })))
  const roll = stored()
  roll.message.result.damage.damageType = "healing"
  assert.throws(() => adjustStoredRoll(roll, request({ target: "damage", critical: true })))
})

function storage() {
  const data = new Map()
  const tx = { delete: async key => data.delete(key), get: async key => structuredClone(data.get(key)), put: async (key, value) => { data.set(key, structuredClone(value)) } }
  return { ...tx, transaction: async fn => fn(tx) }
}
const socket = role => ({ messages: [], deserializeAttachment() { return { userId: role === "MASTER" ? "master" : "other", role, visibleCharacterIds: ["char"] } },
  send(value) { this.messages.push(JSON.parse(value)) } })

test("server rejects player changes and never exposes private results to other players", async () => {
  const db = storage()
  const master = socket("MASTER"), other = socket("PLAYER")
  await broadcastRollResult(db, [master, other], action())
  await assert.rejects(handleRollAdjustment(db, [master, other], { role: "PLAYER" }, request({ mode: "advantage" })), /Somente o mestre/)
  await handleRollAdjustment(db, [master, other], { role: "MASTER" }, request({ mode: "advantage" }))
  assert.equal(master.messages.length, 2)
  assert.equal(other.messages.length, 0)
  await assert.rejects(handleRollAdjustment(db, [], { role: "MASTER" }, request({ rollId: "missing", mode: "normal" })), /indisponível/)
})

test("only the latest 100 original rolls remain adjustable", async () => {
  const db = storage()
  for (let i = 0; i < 101; i++) {
    const msg = action(); msg.result.id = String(i)
    await broadcastRollResult(db, [], msg)
  }
  await assert.rejects(handleRollAdjustment(db, [], { role: "MASTER" }, request({ rollId: "0", mode: "normal" })), /indisponível/)
  await handleRollAdjustment(db, [], { role: "MASTER" }, request({ rollId: "100", mode: "normal" }))
})

test("standalone damage cards support critical and restoration", () => {
  const message = { type: "session.dice.result", result: {
    id: "roll", requestId: "request", actorId: "player", label: "Dano",
    kind: "damage", mode: "normal", createdAt: "2026-11-15T10:00:00Z", ...damage(),
  } }
  const roll = stored(message)
  adjustStoredRoll(roll, request({ target: "damage", critical: true }), undefined, () => 5)
  assert.equal(roll.message.result.total, 10)
  adjustStoredRoll(roll, request({ target: "damage", critical: false }))
  assert.equal(roll.message.result.total, 5)
})

test("repeating an adjustment is idempotent and does not spend resources or reroll", async () => {
  const db = storage()
  await broadcastRollResult(db, [], action())
  const req = request({ target: "damage", damageIndex: 0, critical: true })
  await handleRollAdjustment(db, [], { role: "MASTER" }, req)
  const before = await db.get("adjustable-roll:roll")
  await handleRollAdjustment(db, [], { role: "MASTER" }, req)
  assert.deepEqual(await db.get("adjustable-roll:roll"), before)
})
