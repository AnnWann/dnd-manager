import test from "node:test"
import assert from "node:assert/strict"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

// Run the authoritative operation reducer, not a reimplementation. Source
// aliases also exercise the same code on a fresh CI checkout before the build.
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../../../apps/session-server/src/routes/initiative/InitiativeSessionActor.ts", import.meta.url))],
  alias: Object.fromEntries([
    ["critical-damage", "criticalDamage"],
    ["campaign-progression", "campaignProgression"],
    ["long-rest-settings", "longRestSupplySettings"],
    ["manual-dice", "manualDiceExpression"],
  ].map(([key, file]) => [`@dnd-manager/game-core/${key}`, fileURLToPath(new URL(`../../game-core/src/${file}.ts`, import.meta.url))])),
  bundle: true, platform: "node", format: "esm", target: "node24", write: false,
})
const { applyInitiativeOperation } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"))

const entry = (id, combatantId, currentHp = 52, temporaryHp = 0) => ({
  id, combatantId, sourceType: "monster", sourceId: "compendium:eldren", name: "Eldren",
  currentHp, maxHp: 68, temporaryHp, conditions: [], side: "enemy", hidden: false, defeated: false,
  initiative: 20, initiativeBonus: 0, order: 0, createdAt: 1,
})
const session = entries => ({ version: 1, id: "combat", name: "Combat", entries,
  started: false, round: 1, viewMode: "table", deathSaveVisibility: "owner", deathSaveOwnerCanEdit: false,
  createdAt: 1, updatedAt: 1 })
const apply = (before, entryIds, effect, config = null) => applyInitiativeOperation(before,
  { type: "initiative.hp.apply", characterId: "session", entryIds, ...effect }, config, {}, {})
const damage = amount => ({ mode: "damage", parts: [{ amount, damageType: "piercing" }] })

for (const turnCount of [2, 3, 5]) {
  for (const selected of ["first", "last", "all"]) {
    test(`${turnCount} turns, select ${selected}: one damage/heal application per combatant`, () => {
      const entries = Array.from({ length: turnCount }, (_, i) => entry(`turn-${i}`, "eldren"))
      const selectedIds = selected === "all" ? entries.map(e => e.id)
        : [entries[selected === "first" ? 0 : turnCount - 1].id]
      for (const [effect, expected] of [[damage(8), 44], [{ mode: "heal", amount: 6 }, 58]]) {
        const before = session(entries)
        const result = apply(before, selectedIds, effect)
        assert.equal(result.ok, true)
        assert.deepEqual(result.session.entries.map(e => e.currentHp), Array(turnCount).fill(expected))
        assert.equal(result.operation.results.length, 1)
        assert.equal(result.operation.entryIds.length, 1)
        assert.equal(result.operation.entryIds[0], selectedIds[0])
        assert.deepEqual(before.entries.map(e => e.currentHp), Array(turnCount).fill(52))
      }
    })
  }
}

test("temporary HP absorbs damage once, and temporary grants are not multiplied", () => {
  const before = session([entry("a", "eldren", 52, 5), entry("b", "eldren", 52, 5)])
  const damaged = apply(before, ["b", "a", "b"], damage(8))
  assert.equal(damaged.ok, true)
  assert.deepEqual(damaged.session.entries.map(e => [e.currentHp, e.temporaryHp]), [[49, 0], [49, 0]])
  assert.deepEqual(damaged.operation.results.map(r => [r.applied, r.absorbedTemporary, r.hpDelta]), [[8, 5, -3]])
  const granted = apply(before, ["a"], { mode: "temporary", amount: 3 })
  assert.deepEqual(granted.session.entries.map(e => e.temporaryHp), [8, 8])
  assert.equal(granted.operation.results.length, 1)
})

test("different creatures of the same template remain separate targets", () => {
  const before = session([entry("a1", "one"), entry("a2", "one"), entry("b1", "two"), entry("b2", "two"), entry("single", undefined)])
  const result = apply(before, ["a2", "b1", "a1", "single", "b2"], damage(8))
  assert.equal(result.ok, true)
  assert.deepEqual(result.session.entries.map(e => e.currentHp), [44, 44, 44, 44, 44])
  assert.deepEqual(result.operation.entryIds, ["a2", "b1", "single"])
  assert.equal(result.operation.results.length, 3)
})

test("repeated separate operations still apply separately", () => {
  const first = apply(session([entry("a", "eldren"), entry("b", "eldren")]), ["a"], damage(8))
  const second = apply(first.session, ["b"], damage(8))
  assert.deepEqual(second.session.entries.map(e => e.currentHp), [36, 36])
})

test("affinities and multiple damage parts are resolved once for the shared pool", () => {
  const before = session([entry("a", "eldren"), entry("b", "eldren"), entry("c", "eldren")])
  const config = { config: { creatureCompendium: [{ id: "eldren", damageAffinities: [{ damageType: "fire", kind: "resistance" }] }] } }
  const result = apply(before, ["a", "b"], { mode: "damage", parts: [{ amount: 9, damageType: "fire" }, { amount: 3, damageType: "piercing" }] }, config)
  assert.equal(result.ok, true)
  assert.deepEqual(result.session.entries.map(e => e.currentHp), [45, 45, 45])
  assert.equal(result.operation.results[0].applied, 7)
})

test("healing caps once at max HP; damage cannot drop below zero", () => {
  for (const [effect, expected] of [[{ mode: "heal", amount: 100 }, 68], [damage(100), 0]]) {
    const result = apply(session([entry("a", "eldren"), entry("b", "eldren")]), ["a"], effect)
    assert.deepEqual(result.session.entries.map(e => e.currentHp), [expected, expected])
    assert.equal(result.operation.results.length, 1)
  }
})

test("missing selected entries reject the operation without changing HP", () => {
  const before = session([entry("a", "eldren"), entry("b", "eldren")])
  const result = apply(before, ["a", "missing"], damage(8))
  assert.equal(result.ok, false)
  assert.equal(result.code, "INITIATIVE_ENTRY_NOT_FOUND")
  assert.deepEqual(before.entries.map(e => e.currentHp), [52, 52])
})
