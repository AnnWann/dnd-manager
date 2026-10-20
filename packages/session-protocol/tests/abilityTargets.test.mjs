import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

// Execute production TypeScript through a bundled ESM module, using the same
// resolver the web/session-server builds use. No mock roll or rule implementation.
async function loadProductionModule(relative) {
  const entry = fileURLToPath(new URL(relative, import.meta.url))
  const built = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", target: "node24", write: false })
  return import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
}
const [{ applyHpToReferences, validateAbilityTargets }, { abilityTargetGrants, createTargetCondition, applyConditionToReferences }] = await Promise.all([
  loadProductionModule("../../../apps/session-server/src/routes/characters/abilities/abilityTargeting.ts"),
  loadProductionModule("../../../apps/session-server/src/routes/characters/abilities/abilityTargetConditions.ts"),
])

const hp = (current, max, temporary = 0) => ({ current, max, currentMax: max, maxHpBonus: 0, temporary, revision: 0 })
const emptyTargets = () => ({
  hp: { a: hp(20, 20, 4), b: hp(12, 20) },
  conditions: {
    a: { characterId: "a", conditions: [], revision: 0, initialized: true },
    b: { characterId: "b", conditions: [], revision: 0, initialized: true },
  },
  companions: {},
  initiative: undefined,
  creatures: [{ id: "owl", name: "Coruja", ownerUserId: "p", maxHp: 14, traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [], damageAffinities: [{ damageType: "fire", kind: "vulnerability" }] }],
  affinities: {
    a: [{ damageType: "fire", kind: "resistance" }],
    b: [{ damageType: "fire", kind: "immunity" }],
  },
  changedCharacters: new Set(),
  changedConditions: new Set(),
  changedCompanions: new Set(),
  initiativeChanged: false,
})

test("target-mode validation rejects unconfigured, duplicate and excess recipients", () => {
  assert.deepEqual(validateAbilityTargets(undefined, undefined, "a"), [])
  assert.equal(validateAbilityTargets(undefined, ["character:b"], "a"), null)
  assert.deepEqual(validateAbilityTargets({ mode: "self" }, [], "a"), ["character:a"])
  assert.equal(validateAbilityTargets({ mode: "self" }, ["character:b"], "a"), null)
  assert.deepEqual(validateAbilityTargets({ mode: "point", maxTargets: 2 }, ["character:a", "companion:owl"], "a"), ["character:a", "companion:owl"])
  assert.equal(validateAbilityTargets({ mode: "point", maxTargets: 2 }, ["character:a", "character:a"], "a"), null)
  assert.equal(validateAbilityTargets({ mode: "targets", maxTargets: 1 }, ["character:a", "character:b"], "a"), null)
})

test("one rolled fire damage applies target-specific affinity and temporary HP independently", () => {
  const state = emptyTargets()
  assert.equal(applyHpToReferences(state, ["character:a", "character:b"], { kind: "damage", damageType: "fire" }, 9), true)
  assert.equal(state.hp.a.current, 20)
  assert.equal(state.hp.a.temporary, 0) // 9 / 2 rounded down = 4, absorbed by THP
  assert.equal(state.hp.b.current, 12) // fire immunity
  assert.deepEqual([...state.changedCharacters].sort(), ["a", "b"])
})

test("damage can bypass temporary HP, while healing caps at maximum HP", () => {
  const state = emptyTargets()
  assert.equal(applyHpToReferences(state, ["character:a"], { kind: "damage", damageType: "fire", ignoreResistance: true, bypassTemporaryHp: true }, 7), true)
  assert.equal(state.hp.a.current, 13)
  assert.equal(state.hp.a.temporary, 4)
  assert.equal(applyHpToReferences(state, ["character:a"], { kind: "heal" }, 30), true)
  assert.equal(state.hp.a.current, 20)
})

test("companions use the same HP application logic and persistent damage affinity rules", () => {
  const state = emptyTargets()
  assert.equal(applyHpToReferences(state, ["companion:owl"], { kind: "damage", damageType: "fire" }, 4), true)
  assert.equal(state.companions.owl.currentHp, 6) // vulnerable to fire, 14 - 8
  assert.deepEqual([...state.changedCompanions], ["owl"])
  assert.equal(applyHpToReferences(state, ["companion:missing"], { kind: "heal" }, 3), false)
})

test("ability buffs and grant conditions resolve independently from instant HP effects", () => {
  const ability = {
    id: "aura",
    name: "Aura protetora",
    bonuses: { onUseHp: [{ kind: "heal", bonus: { type: "add", value: 4 } }], armorClass: [{ type: "add", value: 2 }] },
    conditionOnUse: { name: "Abençoado", tags: ["magia"], duration: { type: "rounds", total: 3 } },
  }
  const grants = abilityTargetGrants(ability)
  assert.equal(grants.length, 2)
  assert.equal(grants[0].grant.bonuses.onUseHp, undefined)
  const state = emptyTargets()
  for (const grant of grants) {
    const condition = createTargetCondition("caster", ability, grant)
    assert.equal(applyConditionToReferences(state, ["character:a", "character:b", "companion:owl"], condition), true)
  }
  assert.equal(state.conditions.a.conditions.length, 2)
  assert.equal(state.conditions.b.conditions.length, 2)
  assert.equal(state.conditions.a.conditions[0].bonuses.armorClass[0].value, 2)
  assert.equal(state.companions.owl.conditions.length, 2)
  assert.equal(state.companions.owl.conditions[1].duration.type, "rounds")
  assert.deepEqual([...state.changedConditions].sort(), ["a", "b"])
})

test("target effects can be reverted using the pre-operation snapshot", () => {
  const state = emptyTargets()
  const before = structuredClone(state)
  const ability = { id: "shield", name: "Escudo", conditionOnUse: { name: "Protegido" } }
  const condition = createTargetCondition("caster", ability, abilityTargetGrants(ability)[0])
  applyHpToReferences(state, ["character:a", "character:b"], { kind: "damage", damageType: "necrotic" }, 5)
  applyConditionToReferences(state, ["character:a", "character:b"], condition)
  // The composed session actor's targetReverse snapshot restores the touched pools.
  for (const id of state.changedCharacters) state.hp[id] = before.hp[id]
  for (const id of state.changedConditions) state.conditions[id] = before.conditions[id]
  assert.deepEqual(state.hp, before.hp)
  assert.deepEqual(state.conditions, before.conditions)
})
