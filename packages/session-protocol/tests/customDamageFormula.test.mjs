import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

const compiled = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL("../../../", import.meta.url)),
    contents: [
      'export { CharacterTemplate } from "./apps/web/src/models/characters/CharacterTemplate"',
      'export { activateCustomSystemActionWithRoll, validateCustomAbilityDamageSource, validateCustomAbilityDiceSource } from "./apps/web/src/lib/customSystems/CustomAbilityRoll"',
    ].join("\n"),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  conditions: ["types"],
  write: false,
})
const {
  CharacterTemplate, activateCustomSystemActionWithRoll,
  validateCustomAbilityDamageSource, validateCustomAbilityDiceSource,
} = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"))

const definition = {
  id: "techniques", version: 1, name: "Técnicas", resources: [],
  fields: [{ id: "bonus", name: "Bônus", type: "number" }, { id: "die", name: "Dado", type: "dice" }],
}
const character = CharacterTemplate.fromJSON({
  id: "fighter",
  sheet: {
    attributes: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  },
}).withSheet("customSystems", [{
  systemId: definition.id, systemVersion: 1, enabled: true,
  fields: { bonus: 5, die: "1d6" }, resources: {}, abilities: [],
}])
function use(damage, options = {}) {
  const { kind = "damage", activationLevel, natural, mode = "automatic", manualDamage } = options
  return activateCustomSystemActionWithRoll(character, [{
    ...definition,
    actions: [{
      id: "strike", name: "Golpe", level: { baseLevel: 1 },
      roll: { kind, mode, damage },
    }],
  }], definition.id, "strike", natural, activationLevel, manualDamage).roll
}

test("custom action damage accepts constants, numeric variables and character formulas", () => {
  const expressions = ["2", "field.bonus", "1 + floor(character.attributeModifier.str / 2)"]
  for (const expression of expressions) {
    assert.equal(validateCustomAbilityDamageSource(expression, definition), undefined)
  }
  const result = use(expressions.map((dice, index) => ({ id: String(index), dice })))
  assert.deepEqual(result.damages.map(damage => damage.total), [2, 5, 3])
  assert.ok(result.damages.every(damage => damage.groups.length === 0))
  assert.equal(result.total, 10)
  assert.ok(validateCustomAbilityDiceSource("2", definition))
})

test("numeric base damage is counted once when upcast dice double on a critical", () => {
  const result = use([{ id: "mixed", dice: "field.bonus", upcastDicePerLevel: "1d6", modifierFormula: "2" }], {
    kind: "attack", natural: 20, activationLevel: 2,
  })
  const damage = result.damages[0]
  assert.equal(damage.critical, true)
  assert.equal(damage.groups[0].rolls.length, 2)
  assert.equal(damage.diceModifier, 5)
  assert.equal(damage.total, 7 + damage.groups[0].rolls.reduce((sum, face) => sum + face, 0))
})

test("dice variables and manually supplied damage totals still work", () => {
  const damage = use([{ id: "die", dice: "field.die" }]).damages[0]
  assert.equal(damage.groups[0].sides, 6)
  const manual = use([{ id: "fixed", dice: "field.bonus", modifierFormula: "2" }], {
    mode: "manual", manualDamage: [7],
  }).damages[0]
  assert.equal(manual.total, 9)
})
