import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const entry = fileURLToPath(new URL("../../../apps/owlbear-extension/src/owlbearSpellCatalog.ts", import.meta.url))
const built = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", target: "node24", write: false })
const { findOwlbearInitiativeCreature, resolveOwlbearSpellDefinitions, listMissingCreatureSpells } =
  await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))

const spell = (index, name) => ({ index, name, displayName: name, slotLevel: 2, description: "Teste" })
const creature = { id: "medusa-id", name: "Medusa Ateniense", spellcasting: { spells: [
  { spellIndex: "shatter", usage: { type: "perDay", uses: 3 } },
  { spellIndex: "uuid-custom", usage: { type: "atWill" } },
] } }

test("compendium:<id> initiative links resolve the full creature definition", () => {
  assert.strictEqual(findOwlbearInitiativeCreature([creature], { sourceId: "compendium:medusa-id" }), creature)
  assert.strictEqual(findOwlbearInitiativeCreature([creature], { sourceId: "medusa-id" }), creature)
  assert.equal(findOwlbearInitiativeCreature([creature], { sourceId: "compendium:unknown" }), undefined)
})

test("the Owlbear creature inspector receives official spells from session runtime", () => {
  const runtime = { config: { spells: [spell("shatter", "Despedaçar")] } }
  const definitions = resolveOwlbearSpellDefinitions(runtime, [])
  assert.deepEqual(definitions.map(entry => entry.name), ["Despedaçar"])
  assert.deepEqual(listMissingCreatureSpells(creature, definitions), ["uuid-custom"])
})

test("campaign homebrew UUID spell references resolve from authorized spell library", () => {
  const definitions = resolveOwlbearSpellDefinitions(
    { config: { spells: [spell("shatter", "Despedaçar")] } },
    [spell("uuid-custom", "Olhar Arcano")],
  )
  assert.deepEqual(listMissingCreatureSpells(creature, definitions), [])
  assert.equal(definitions.find(entry => entry.index === "uuid-custom").name, "Olhar Arcano")
})

test("authoritative session spell definitions override stale library copies", () => {
  const definitions = resolveOwlbearSpellDefinitions(
    { config: { spells: [spell("uuid-custom", "Versão da sessão")] } },
    [spell("uuid-custom", "Versão antiga")],
  )
  assert.equal(definitions.length, 1)
  assert.equal(definitions[0].name, "Versão da sessão")
})

test("malformed spell definitions are discarded rather than breaking the inspector", () => {
  const definitions = resolveOwlbearSpellDefinitions(
    { config: { spells: [null, {}, { index: "bad", name: "Bad", slotLevel: -1 }, spell("shatter", "Despedaçar")] } },
    [{ index: "missing-slot", name: "Invalid" }],
  )
  assert.deepEqual(definitions.map(entry => entry.index), ["shatter"])
})
