import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

async function loadFeed() {
  const entry = fileURLToPath(new URL("../../../apps/web/src/features/session/abilityRollFeed.ts", import.meta.url))
  const output = await build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", target: "node24", write: false,
  })
  return import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"))
}

const { buildAbilityRollFeed } = await loadFeed()
const roll = (value) => ({
  key: "onUseHp:0", label: "Dano ao usar", mode: "automatic", dice: "1d6",
  diceValue: value, formulaBonus: 0, total: value,
})
const activation = (id, time, value) => ({
  id, createdAt: time, operation: {
    type: "character.ability.use", characterId: "gus", abilityName: "Rito Carmesim",
    bonusRollResults: [roll(value)],
  },
})

test("ability dice are grouped under the same named ability rather than separate roll cards", () => {
  const result = buildAbilityRollFeed([activation("a", "2026-10-20T10:00:00Z", 2)], new Set())
  assert.equal(result.length, 1)
  assert.equal(result[0].type, "ability")
  assert.equal(result[0].title, "Rito Carmesim")
  assert.equal(result[0].rolls.length, 1)
  assert.equal(result[0].rolls[0].total, 2)
})

test("feed is newest first and uses the exact saved server result", () => {
  const previous = activation("previous", "2026-10-20T10:00:00Z", 1)
  const latest = activation("latest", "2026-10-20T10:02:00Z", 2)
  const result = buildAbilityRollFeed([previous, latest], new Set())
  assert.deepEqual(result.map(entry => entry.id), ["latest", "previous"])
  assert.deepEqual(result.map(entry => entry.rolls[0].total), [2, 1])
  // The source record is not mutated or rerolled by display formatting.
  assert.strictEqual(result[0].rolls, latest.operation.bonusRollResults)
})

test("clearing hides exactly the existing server log IDs and retains newly used abilities", () => {
  const first = activation("old-1", "2026-10-20T10:00:00Z", 4)
  const second = activation("old-2", "2026-10-20T10:01:00Z", 3)
  const third = activation("new", "2026-10-20T10:02:00Z", 6)
  const hidden = new Set(["old-1", "old-2"])
  assert.deepEqual(buildAbilityRollFeed([first, second, third], hidden).map(entry => entry.id), ["new"])
  assert.deepEqual(buildAbilityRollFeed([first, second], hidden), [])
})

test("undo removes old activation cards without losing the audit log", () => {
  const undone = { ...activation("undo", "2026-10-20T10:00:00Z", 5), undoneAt: "2026-10-20T10:01:00Z" }
  assert.deepEqual(buildAbilityRollFeed([undone], new Set()), [])
})

test("one ability activation with multiple rolls remains a single grouped card", () => {
  const a = activation("double", "2026-10-20T10:00:00Z", 2)
  a.operation.bonusRollResults.push({ ...roll(4), key: "onUseHp:1", label: "Cura ao usar" })
  const feed = buildAbilityRollFeed([a], new Set())
  assert.equal(feed.length, 1)
  assert.deepEqual(feed[0].rolls.map(entry => entry.total), [2, 4])
})
