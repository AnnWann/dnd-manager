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

const [{ CharacterTemplate }, { getActiveAttackRiders, getActiveAttackRiderEntries, optionRequiresWeaponSelection }, { getAbilityWeaponInfusions },
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

test("weapon inspector identifies which condition owns the applied extra die", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1")
  const entries = getActiveAttackRiderEntries(c, { scope: "weapon", weaponId: "w1" })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].origin.type, "condition")
  assert.equal(entries[0].origin.sourceAbilityId, "rite")
  assert.equal(entries[0].rider.damage.dice, "1d6")
  assert.equal(entries[0].rider.damage.damageType, "lightning")
  assert.equal(getActiveAttackRiderEntries(c, { scope: "weapon", weaponId: "w2" }).length, 0)
})

test("a copied on-hit rider stored twice cannot roll twice and both sources remain inspectable", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1")
  const condition = getCharacterConditions(c).find(value => value.sourceAbilityOptionId?.includes(":abilities"))
  assert.ok(condition)
  // A legacy editor could store the same on-hit rider directly on a
  // condition as well as on the ability granted by that condition.
  const malformed = c.withSheet("conditions", getCharacterConditions(c).map(value => value.id !== condition.id
    ? value : { ...value, bonuses: { attackRiders: value.grantedAbilities[0].bonuses.attackRiders } }))
  const effective = getActiveAttackRiderEntries(malformed, { scope: "weapon", weaponId: "w1" })
  const inspected = getActiveAttackRiderEntries(malformed, { scope: "weapon", weaponId: "w1" }, { includeDuplicates: true })
  assert.equal(effective.length, 1)
  assert.equal(inspected.length, 2)
  assert.equal(inspected.filter(value => value.suppressedDuplicate).length, 1)
  assert.equal(getActiveAttackRiders(malformed, { scope: "weapon", weaponId: "w1" }).length, 1)
})

test("removing the original effect after a double projection leaves no phantom rider", () => {
  const c = character().useAbility("rite", "storm", undefined, "w1")
  const condition = getCharacterConditions(c).find(value => value.sourceAbilityOptionId?.includes(":abilities"))
  assert.ok(condition)
  const malformed = c.withSheet("conditions", getCharacterConditions(c).map(value => value.id !== condition.id
    ? value : { ...value, bonuses: { attackRiders: value.grantedAbilities[0].bonuses.attackRiders } }))
  const cleaned = removeCharacterCondition(malformed, condition.id)
  assert.equal(getActiveAttackRiderEntries(cleaned, { scope: "weapon", weaponId: "w1" }).length, 0)
  assert.equal(getCharacterConditions(cleaned).some(value => value.id === condition.id), false)
})

test("a base ability rider requiring an activation weapon creates a real bound condition", () => {
  const baseRite = { ...rite, activationOptions: undefined, bonuses: { attackRiders: [infusedRider] } }
  const initial = CharacterTemplate.fromJSON({
    id: "direct-rite", name: "Direct rite", abilities: [baseRite],
    equipment: { weapons: [{ id: "w1", name: "Espada curta" }, { id: "w2", name: "Condutor Dracônico" }] },
  })
  assert.equal(optionRequiresWeaponSelection(baseRite), true)
  assert.equal(initial.useAbility("rite").toJSON().abilities[0].benefitsActive, undefined)
  const first = initial.useAbility("rite", undefined, undefined, "w1")
  assert.deepEqual(getAbilityWeaponInfusions(first, "rite").map(entry => entry.weaponId), ["w1"])
  assert.equal(active(first, "w1").length, 1)
  assert.equal(active(first, "w2").length, 0)
  const second = first.useAbility("rite", undefined, undefined, "w2")
  assert.deepEqual(getAbilityWeaponInfusions(second, "rite").map(entry => entry.weaponId).sort(), ["w1", "w2"])
  assert.equal(active(second, "w1").length, 1)
  assert.equal(active(second, "w2").length, 1)
  assert.deepEqual(second.useAbility("rite", undefined, undefined, "w1").toJSON(), second.toJSON())
  const withoutFirst = removeCharacterCondition(second, getAbilityWeaponInfusions(second, "rite").find(entry => entry.weaponId === "w1").conditionId)
  assert.equal(active(withoutFirst, "w1").length, 0)
  assert.equal(active(withoutFirst, "w2").length, 1)
  const ended = second.deactivateAbility("rite")
  assert.equal(active(ended, "w1").length, 0)
  assert.equal(active(ended, "w2").length, 0)
})

test("an activation option with its own rider but no granted subability binds the selected weapon", () => {
  const optionRite = { ...rite, activationOptions: [{ id: "flame", name: "Rito das Chamas", bonuses: { attackRiders: [
    { ...infusedRider, id: "flame-die", damage: { dice: "1d6", damageType: "fire" } },
  ] } }] }
  const initial = CharacterTemplate.fromJSON({
    id: "option-rite", name: "Option rite", abilities: [optionRite],
    equipment: { weapons: [{ id: "w1", name: "Espada curta" }, { id: "w2", name: "Condutor Dracônico" }] },
  })
  assert.equal(optionRequiresWeaponSelection(optionRite, "flame"), true)
  const applied = initial.useAbility("rite", "flame", undefined, "w2")
  assert.equal(active(applied, "w1").length, 0)
  assert.equal(active(applied, "w2").length, 1)
  assert.equal(active(applied, "w2")[0].damage.damageType, "fire")
  assert.deepEqual(getAbilityWeaponInfusions(applied, "rite").map(entry => entry.weaponId), ["w2"])
})

test("base and option riders retain their own identities while following one selected weapon", () => {
  const combined = { ...rite, bonuses: { attackRiders: [{ ...infusedRider, id: "base" }] } }
  const initial = CharacterTemplate.fromJSON({
    id: "combined", name: "Combined", abilities: [combined],
    equipment: { weapons: [{ id: "w1", name: "Espada curta" }, { id: "w2", name: "Condutor Dracônico" }] },
  })
  const applied = initial.useAbility("rite", "storm", undefined, "w1")
  assert.equal(active(applied, "w1").length, 2)
  assert.equal(active(applied, "w2").length, 0)
  assert.equal(getAbilityWeaponInfusions(applied, "rite").length, 1)
})
