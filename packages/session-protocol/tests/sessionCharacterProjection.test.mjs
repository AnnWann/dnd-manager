import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const built = await build({
  stdin: {
    contents: `export { projectSessionCharacterState } from "./apps/web/src/features/session-runtime/projectSessionCharacterState"; export { CharacterTemplate } from "./apps/web/src/models/characters/CharacterTemplate"; export { getCurrentMaxHp } from "./apps/web/src/models/characters/characterHp";`,
    loader: "ts", resolveDir: fileURLToPath(new URL("../../../", import.meta.url)),
  },
  bundle: true, format: "esm", platform: "node", target: "node24", write: false,
})
const { projectSessionCharacterState, CharacterTemplate, getCurrentMaxHp } =
  await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))

const pool = (side, quantity) => ({
  current: { quantity, sides: side }, max: { quantity, sides: side },
})
function character() {
  return CharacterTemplate.fromJSON({
    id: "tiberius", name: "Tiberius",
    sheet: { HP: { current: 47, max: 47, currentMax: 47, temporary: 0, hitDice: { d8: pool("d8", 4) } } },
  })
}
function hp(patch = {}) {
  return {
    characterId: "tiberius", current: 52, max: 52, currentMax: 52, temporary: 0,
    hitDice: { d8: { current: 4, max: 4 }, d12: { current: 1, max: 1 } },
    attributesInitialized: false, savingThrowsInitialized: false, skillsInitialized: false, statsInitialized: false,
    ...patch,
  }
}

test("live manual maximum replaces the stale current maximum on both sheet clients", () => {
  const original = character()
  const result = projectSessionCharacterState(original, hp())
  assert.equal(result.get("sheet").HP.current, 52)
  assert.equal(result.get("sheet").HP.max, 52)
  assert.equal(getCurrentMaxHp(result), 52)
  assert.equal(original.get("sheet").HP.currentMax, 47)
  assert.equal(original.get("sheet").HP.max, 47)
})

test("genuine maximum reductions remain distinct from the manually set real maximum", () => {
  const reduced = projectSessionCharacterState(character(), hp({ current: 38, max: 52, currentMax: 42 }))
  assert.equal(reduced.get("sheet").HP.max, 52)
  assert.equal(getCurrentMaxHp(reduced), 42)
  const restored = projectSessionCharacterState(reduced, hp())
  assert.equal(getCurrentMaxHp(restored), 52)
  const lowered = projectSessionCharacterState(restored, hp({ current: 35, max: 35, currentMax: 35 }))
  assert.equal(lowered.get("sheet").HP.max, 35)
  assert.equal(getCurrentMaxHp(lowered), 35)
})

test("all authoritative hit dice pools and their spent quantities are preserved", () => {
  const result = projectSessionCharacterState(character(), hp({
    temporary: 7, hitDice: { d8: { current: 2, max: 4 }, d12: { current: 0, max: 1 } },
  }))
  assert.deepEqual(result.get("sheet").HP.hitDice, {
    d8: { current: { quantity: 2, sides: "d8" }, max: { quantity: 4, sides: "d8" } },
    d12: { current: { quantity: 0, sides: "d12" }, max: { quantity: 1, sides: "d12" } },
  })
  assert.equal(result.get("sheet").HP.temporary, 7)
  assert.deepEqual(projectSessionCharacterState(result, hp({ hitDice: {} })).get("sheet").HP.hitDice, {})
})

test("uninitialized domains preserve the sheet and absent HP snapshot leaves manual values intact", () => {
  const original = character()
  assert.equal(projectSessionCharacterState(original), original)
  const result = projectSessionCharacterState(original, hp())
  assert.deepEqual(result.get("sheet").attributes, original.get("sheet").attributes)
  assert.deepEqual(result.get("sheet").stats, original.get("sheet").stats)
})
