import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { normalizeCreatedAbility } from "../../../apps/web/src/features/characters/creation/normalizeCreatedAbility.ts"

const makeAbility = (kind) => ({
  id: "custom-feature",
  name: "Proteção ancestral",
  kind,
  actionKind: "reaction",
  effectDuration: "lasting",
  trigger: "onHit",
  usage: { max: 2, used: 0, reset: "longRest" },
  bonuses: { armorClass: [{ type: "add", value: 1 }] },
  grantedSpells: [{ spellIndex: "shield" }],
})

test("character creation preserves active, passive and feature kinds for class and race", () => {
  for (const source of ["class", "race"]) {
    for (const kind of ["active", "passive", "feature"]) {
      const original = makeAbility(kind)
      const normalized = normalizeCreatedAbility(original, source)
      assert.equal(normalized.kind, kind, `source=${source}, kind=${kind}`)
      assert.equal(normalized.source, source)
      assert.equal(normalized.actionKind, original.actionKind)
      assert.deepEqual(normalized.usage, original.usage)
      assert.deepEqual(normalized.bonuses, original.bonuses)
      assert.deepEqual(normalized.grantedSpells, original.grantedSpells)
      assert.equal(original.source, undefined, "source must remain immutable")
    }
  }
})

test("only a missing kind defaults to a feature; category is normalized independently", () => {
  assert.equal(normalizeCreatedAbility({ id: "a", name: "Legado" }, "race").kind, "feature")
  const passive = normalizeCreatedAbility({
    ...makeAbility("passive"), category: "feat",
  }, "race")
  assert.equal(passive.kind, "passive")
  assert.equal(passive.category, "general")
  assert.equal(normalizeCreatedAbility({
    ...makeAbility("active"), category: "invocation",
  }, "class").kind, "active")
})

test("legacy creation paths use the shared kind-preserving normalization", () => {
  const root = new URL("../../../apps/web/src/features/characters/creation/", import.meta.url)
  const bridge = readFileSync(new URL("bridges/CreationProgressionConfigurationBridge.tsx", root), "utf8")
  const finalize = readFileSync(new URL("creationProgressionConfiguration.ts", root), "utf8")
  const racialChoices = readFileSync(new URL("CharacterCreationRacialChoices.tsx", root), "utf8")
  assert.match(bridge, /normalizeCreatedAbility\(ability, abilityTarget\.source\)/)
  assert.match(finalize, /normalizeCreatedAbility\(ability, "class"\)/)
  assert.match(finalize, /normalizeCreatedAbility\(ability, "race"\)/)
  assert.match(finalize, /kind: ability\.kind \?\? "feature",\s+category: "invocation"/)
  assert.match(racialChoices, /kind: featAbility\.kind \?\? "feature"/)
})
