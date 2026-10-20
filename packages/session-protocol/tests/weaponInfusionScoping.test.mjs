import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

async function production(relative) {
  const built = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    alias: {
      "@dnd-manager/game-core/long-rest-settings": fileURLToPath(new URL("../../../packages/game-core/src/longRestSupplySettings.ts", import.meta.url)),
      "@dnd-manager/game-core/campaign-progression": fileURLToPath(new URL("../../../packages/game-core/src/campaignProgression.ts", import.meta.url)),
      "@dnd-manager/game-core/manual-dice": fileURLToPath(new URL("../../../packages/game-core/src/manualDiceExpression.ts", import.meta.url)),
    },
    bundle: true, platform: "node", format: "esm", target: "node24", write: false,
  })
  return import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
}

const [{ CharacterTemplate }, { getActiveAttackRiders }, { getAbilityWeaponInfusions },
  { getCharacterConditions, removeCharacterCondition }] = await Promise.all([
  production("../../../apps/web/src/models/characters/CharacterTemplate.ts"),
  production("../../../apps/web/src/models/combat/AttackRider.ts"),
  production("../../../apps/web/src/models/abilities/abilityActivation.ts"),
  production("../../../apps/web/src/models/characters/characterConditionStorage.ts"),
])

const infusedRider = {
  id: "storm-die", label: "Rito da Tempestade", scope: "weapon",
  weaponSelection: "onActivation", damage: { dice: "1d6", damageType: "lightning", magical: true },
  treatWeaponAsMagical: true,
}
const rite = {
  id: "rite", name: "Rito Carmesim", kind: "active", trigger: "always",
  effectDuration: "lasting", effectPersistence: "untilEnd",
  allowMultipleWeaponActivations: true,
  activationOptions: [{
    id: "storm", name: "Rito da Tempestade",
    abilities: [{ id: "storm-grant", name: "Rito da Tempestade", kind: "passive",
      trigger: "always", bonuses: { attackRiders: [infusedRider] } }],
  }],
}

function character() {
  return CharacterTemplate.fromJSON({
    id: "blood-hunter", name: "Gus", abilities: [rite],
    equipment: { weapons: [{ id: "w1", name: "Espada curta" }, { id: "w2", name: "Condutor Dracônico" }] },
  })
}
const active = (character, weaponId) => getActiveAttackRiders(character, { scope: "weapon", weaponId })

test("one weapon infusion rolls only on its selected weapon", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1")
  assert.equal(getAbilityWeaponInfusions(c, "rite").length, 1)
  assert.equal(active(c, "w1").length, 1)
  assert.equal(active(c, "w1")[0].weaponId, "w1")
  assert.equal(active(c, "w2").length, 0)
})

test("two weapons retain their separate rites without double-counting the condition's rider", () => {
  const first = character().useAbility("rite", "storm", undefined, "w1")
  const second = first.useAbility("rite", "storm", undefined, "w2")
  assert.deepEqual(getAbilityWeaponInfusions(second, "rite").map(item => item.weaponId).sort(), ["w1", "w2"])
  assert.equal(active(second, "w1").length, 1)
  assert.equal(active(second, "w2").length, 1)
  assert.equal(second.useAbility("rite", "storm", undefined, "w1").toJSON(),
    second.toJSON(), "repeating the same infusion must not consume HP or grant a new effect")
})

test("removing one weapon condition preserves the other; ending ability removes all", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1").useAbility("rite", "storm", undefined, "w2")
  const first = getAbilityWeaponInfusions(c, "rite").find(infusion => infusion.weaponId === "w1")
  assert.ok(first)
  const removedFirst = removeCharacterCondition(c, first.conditionId)
  assert.equal(active(removedFirst, "w1").length, 0)
  assert.equal(active(removedFirst, "w2").length, 1)
  assert.equal(getAbilityWeaponInfusions(removedFirst, "rite").length, 1)
  const ended = removedFirst.deactivateAbility("rite")
  assert.equal(getCharacterConditions(ended).filter(condition => condition.sourceAbilityId === "rite").length, 0)
  assert.equal(active(ended, "w2").length, 0)
})

test("removing the root condition cascades to all weapons", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1").useAbility("rite", "storm", undefined, "w2")
  const root = getCharacterConditions(c).find(condition => condition.sourceAbilityId === "rite" && !condition.sourceAbilityOptionId)
  assert.ok(root)
  const cleaned = removeCharacterCondition(c, root.id)
  assert.equal(getAbilityWeaponInfusions(cleaned, "rite").length, 0)
  assert.equal(active(cleaned, "w1").length, 0)
  assert.equal(active(cleaned, "w2").length, 0)
})

test("legacy duplicate conditions on one weapon are collapsed, without losing other weapons", () => {
  const base = character().useAbility("rite", "storm", undefined, "w1").useAbility("rite", "storm", undefined, "w2")
  const original = getCharacterConditions(base)
  const w1 = original.find(condition => condition.id.endsWith(":w1"))
  assert.ok(w1)
  const duplicate = { ...w1, id: w1.id + ":legacy-duplicate",
    createdAt: new Date(Date.parse(w1.createdAt) + 1000).toISOString() }
  // Simulate an older persisted sheet that already contained two copies.
  const legacy = base.withSheet("conditions", [...original, duplicate])
  const canonical = getCharacterConditions(legacy)
  assert.equal(canonical.filter(condition => condition.sourceAbilityId === "rite" && condition.sourceAbilityOptionId?.includes("abilities")).length, 2)
  assert.equal(active(legacy, "w1").length, 1)
  assert.equal(active(legacy, "w2").length, 1)
  const ended = legacy.deactivateAbility("rite")
  assert.equal(getCharacterConditions(ended).filter(condition => condition.sourceAbilityId === "rite").length, 0)
})
