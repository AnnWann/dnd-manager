import assert from "node:assert/strict"
import test from "node:test"
import { parseAbilityDamageFormula } from "../src/abilityDamageFormula.ts"

const customClass = "__custom__-5c437e08-1c2a-4d2b-927c-123456789abc"
const variable = `character.class.${customClass}.level`

test("damage and healing dice accept generated custom-class variable suffixes", () => {
  const expression = `1d6 + ${variable}`
  assert.deepEqual(parseAbilityDamageFormula(expression), {
    quantity: 1, sides: 6, formula: `0 + ${variable}`,
  })
})

test("dice and flat bonuses are separated for critical calculations", () => {
  assert.deepEqual(parseAbilityDamageFormula("2d8+3"), { quantity: 2, sides: 8, formula: "0 +3" })
  assert.deepEqual(parseAbilityDamageFormula("1d6 - floor(character.level / 2)"), {
    quantity: 1, sides: 6, formula: "0 - floor(character.level / 2)",
  })
  assert.equal(parseAbilityDamageFormula("2d8 * 3"), undefined)
  assert.equal(parseAbilityDamageFormula("not dice"), undefined)
})
