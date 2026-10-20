import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const entry = fileURLToPath(new URL("../../../apps/web/src/models/abilities/shouldRollAbilityAction.ts", import.meta.url))
const output = await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  write: false,
})
const { shouldRequestSeparateAbilityActionRoll } = await import(
  "data:text/javascript;base64," + Buffer.from(output.outputFiles[0].contents).toString("base64"),
)

test("an on-use 1d6 damage ability generates no separate action roll", () => {
  const rite = {
    id: "rite", name: "Rito Carmesim",
    bonuses: { onUseHp: [{ kind: "damage", damageType: "lightning", bonus: {
      type: "add", value: 0, roll: { mode: "automatic", dice: "1d6" },
    } }] },
  }
  assert.equal(shouldRequestSeparateAbilityActionRoll(rite), false)
  // Even if an attack was configured, its results must not be emitted as
  // another independent action card for the same use.
  assert.equal(shouldRequestSeparateAbilityActionRoll({ ...rite, roll: { kind: "damage", damage: [{ id: "x", dice: "1d6" }] } }), false)
})

test("explicit attack rolls still run when no activation dice exist", () => {
  assert.equal(shouldRequestSeparateAbilityActionRoll({
    id: "strike", name: "Strike",
    roll: { kind: "attack", damage: [{ id: "x", dice: "1d8" }] },
  }), true)
})

test("option activation dice share the parent ability card", () => {
  const ability = {
    id: "options", name: "Options",
    roll: { kind: "attack" },
    activationOptions: [
      { id: "free", name: "Free" },
      { id: "charged", name: "Charged", bonuses: {
        onUseHp: [{ kind: "heal", bonus: { type: "add", value: 0, roll: { mode: "automatic", dice: "1d4" } } }],
      } },
    ],
  }
  assert.equal(shouldRequestSeparateAbilityActionRoll(ability, "charged"), false)
  assert.equal(shouldRequestSeparateAbilityActionRoll(ability, "free"), true)
})

test("legacy self-damage never issues an additional action roll", () => {
  assert.equal(shouldRequestSeparateAbilityActionRoll({
    id: "legacy", name: "Legacy",
    roll: { kind: "damage" },
    selfDamageOnUse: { dice: "1d6", damageType: "fire" },
  }), false)
})
