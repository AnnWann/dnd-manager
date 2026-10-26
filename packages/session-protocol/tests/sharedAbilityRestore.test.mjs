import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../../../apps/web/src/models/characters/CharacterTemplate.ts", import.meta.url))],
  alias: Object.fromEntries([
    ["campaign-progression", "campaignProgression"],
    ["long-rest-settings", "longRestSupplySettings"],
    ["manual-dice", "manualDiceExpression"],
  ].map(([name, file]) => [
    `@dnd-manager/game-core/${name}`,
    fileURLToPath(new URL(`../../game-core/src/${file}.ts`, import.meta.url)),
  ])),
  bundle: true, platform: "node", format: "esm", target: "node24", write: false,
})
const { CharacterTemplate } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"))

const make = (usedFirst = 2, usedSecond = 2) => CharacterTemplate.fromJSON({
  id: "cleric", name: "Aldren",
  abilities: [
    { id: "shared-a", name: "Primeira técnica", kind: "active",
      usage: { max: 3, used: usedFirst, reset: "shortRest", sharedResourceId: "pixie" } },
    { id: "shared-b", name: "Segunda técnica", kind: "active",
      usage: { max: 3, used: usedSecond, reset: "shortRest", sharedResourceId: "pixie" } },
    { id: "independent", name: "Outra habilidade", kind: "active",
      usage: { max: 5, used: 4, reset: "shortRest" } },
  ],
})

const counts = character => Object.fromEntries(character.get("abilities").map(ability => [ability.id, ability.usage.used]))

test("restore one use updates every ability sharing a resource id", () => {
  const initial = make()
  const restored = initial.restoreAbility("shared-b")
  assert.deepEqual(counts(restored), {
    "shared-a": 1, "shared-b": 1, independent: 4,
  })
  assert.deepEqual(counts(initial), {
    "shared-a": 2, "shared-b": 2, independent: 4,
  }, "the previous sheet must remain immutable")
})

test("restoring from the second shared ability uses the canonical pool, not a stale local counter", () => {
  const restored = make(2, 3).restoreAbility("shared-b")
  assert.equal(restored.get("abilities").find(ability => ability.id === "shared-a").usage.used, 1)
  assert.equal(restored.get("abilities").find(ability => ability.id === "shared-b").usage.used, 1)
})

test("consecutive restores stop at zero and never affect another pool", () => {
  const restored = make().restoreAbility("shared-a").restoreAbility("shared-b").restoreAbility("shared-a")
  assert.deepEqual(counts(restored), { "shared-a": 0, "shared-b": 0, independent: 4 })
})

test("reset of a shared resource updates every linked ability", () => {
  const reset = make().resetAbility("shared-a")
  assert.deepEqual(counts(reset), { "shared-a": 0, "shared-b": 0, independent: 4 })
})
