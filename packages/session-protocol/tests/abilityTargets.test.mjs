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
const [{ areSelectedTargetsDistinct, applyHpToReferences, validateAbilityTargets }, { abilityTargetGrants, createTargetCondition, applyConditionToReferences }] = await Promise.all([
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

test("temporary HP is granted once and resistance buffs on companions change damage", () => {
  const state = emptyTargets()
  assert.equal(applyHpToReferences(state, ["character:b", "companion:owl"], { kind: "temporary" }, 7), true)
  assert.equal(state.hp.b.temporary, 7)
  assert.equal(state.companions.owl.temporaryHp, 7)
  assert.equal(applyHpToReferences(state, ["character:b"], { kind: "temporary" }, 3), true)
  assert.equal(state.hp.b.temporary, 7)
  state.companions.owl.conditions = [{ id: "resist", name: "Resistente", duration: { type: "manual" },
    bonuses: { damageAffinities: [{ damageType: "fire", kind: "resistance" }] } }]
  // Fire resistance and vulnerability cancel, so 4 is absorbed instead of 8.
  assert.equal(applyHpToReferences(state, ["companion:owl"], { kind: "damage", damageType: "fire" }, 4), true)
  assert.equal(state.companions.owl.temporaryHp, 3)
  assert.equal(state.companions.owl.currentHp, 14)
})

test("reapplying a targeted grant refreshes the effect rather than duplicating it", () => {
  const state = emptyTargets()
  const ability = { id: "shield", name: "Escudo", conditionOnUse: { name: "Protegido" } }
  const condition = createTargetCondition("caster", ability, abilityTargetGrants(ability)[0])
  applyConditionToReferences(state, ["character:a", "companion:owl"], condition)
  applyConditionToReferences(state, ["character:a", "companion:owl"], condition)
  assert.equal(state.conditions.a.conditions.length, 1)
  assert.equal(state.companions.owl.conditions.length, 1)
})

test("companion daily spells and conditions are persisted even when no HP or slots changed", async () => {
  const { synchronizeCompanionInitiative } = await loadProductionModule("../../../apps/session-server/src/routes/initiative/companionInitiativeSync.ts")
  const creature = {
    id: "owl", ownerUserId: "p", name: "Coruja", maxHp: 10,
    spellcasting: { slots: { 1: 2 }, spells: [{ spellIndex: "healing", usage: { type: "perDay", uses: 3 } }] },
    traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [],
  }
  const existingCondition = { id: "buff", name: "Abençoado", duration: { type: "manual" } }
  const current = {
    id: "owl-turn", sourceType: "monster", sourceId: "compendium:owl",
    currentHp: 9, maxHp: 10, temporaryHp: 0, conditions: [],
    creatureFeatureResources: {}, creatureSpellResources: {
      slots: { 1: { current: 1, max: 2 } },
      perDay: { healing: { used: 0, max: 3 } },
    },
  }
  const before = { entries: [current] }
  const after = { entries: [{ ...current, conditions: [existingCondition], creatureSpellResources: {
    ...current.creatureSpellResources, perDay: { healing: { used: 1, max: 3 } },
  } }] }
  const state = { owl: {
    creatureId: "owl", currentHp: 9, maxHp: 10, temporaryHp: 0,
    featureUses: {}, spellSlots: { 1: 1 }, spellPerDay: { healing: 0 },
    conditions: [], revision: 2,
  } }
  const result = synchronizeCompanionInitiative(before, after, { config: { creatureCompendium: [creature] } }, state)
  assert.deepEqual(result.changedIds, ["owl"])
  assert.equal(result.companions.owl.spellPerDay.healing, 1)
  assert.deepEqual(result.companions.owl.conditions, [existingCondition])
  assert.equal(result.companions.owl.currentHp, 9)

  const removed = synchronizeCompanionInitiative({ entries: [] }, { entries: [current] },
    { config: { creatureCompendium: [creature] } }, result.companions)
  assert.equal(removed.session.entries[0].creatureSpellResources.perDay.healing.used, 1)
  assert.deepEqual(removed.session.entries[0].conditions, [existingCondition])
})

test("selected targets cannot apply one effect twice through character and initiative aliases", () => {
  const combat = { initialized: true, session: { version: 1, entries: [
    { id: "slot-a", sourceType: "character", sourceId: "a", name: "A", initiative: 10 },
    { id: "turn-owl", sourceType: "monster", sourceId: "compendium:owl", name: "Coruja" },
  ] } }
  assert.equal(areSelectedTargetsDistinct(["character:a", "initiative:slot-a"], combat, []), false)
  assert.equal(areSelectedTargetsDistinct(["companion:owl", "initiative:turn-owl"], combat, [{ id: "owl", ownerUserId: "p" }]), false)
  assert.equal(areSelectedTargetsDistinct(["character:a", "companion:owl"], combat, [{ id: "owl", ownerUserId: "p" }]), true)
})
