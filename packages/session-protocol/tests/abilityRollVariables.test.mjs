import assert from "node:assert/strict"
import test from "node:test"
import { parseAbilityDamageFormula, resolveAbilityDamageFormula, validateAbilityRoll } from "../../../apps/web/src/models/abilities/AbilityRoll.ts"
import { validateCharacterSheetFormula } from "../../../apps/web/src/lib/customSystems/CharacterSheetFormula.ts"

const customClass = "__custom__-5c437e08-1c2a-4d2b-927c-123456789abc"
const variable = `character.class.${customClass}.level`

function characterWithCustomClass(level) {
  const sheet = { classes: [{ className: customClass, level }], customSystems: [] }
  return {
    get: (key) => key === "sheet" ? sheet : undefined,
    getProficiencyBonus: () => 3,
    getEffectiveArmorClass: () => 12,
    getEffectiveInitiative: () => 0,
    getEffectivePassivePerception: () => 10,
    getEffectiveMobility: () => 9,
    getEffectiveMaxHp: () => 30,
    getEffectiveTemporaryHp: () => 0,
    getEffectiveAttribute: () => 10,
    getEffectiveAttributeModifier: () => 0,
    getSavingThrowBonus: () => 0,
  }
}

test("a damage/healing roll accepts class variables with generated hyphenated IDs", () => {
  const expression = `1d6 + ${variable}`
  assert.deepEqual(parseAbilityDamageFormula(expression), { quantity: 1, sides: 6, formula: `0 + ${variable}` })
  const character = characterWithCustomClass(5)
  assert.equal(validateCharacterSheetFormula(`0 + ${variable}`, character), undefined)
  assert.deepEqual(resolveAbilityDamageFormula(expression, character), { quantity: 1, sides: 6, flat: 5 })
  assert.equal(validateAbilityRoll({ kind: "damage", damage: [{ id: "heal", dice: expression, damageType: "healing" }] }, character), undefined)
})

test("roll formulas still accept numeric bonuses and reject malformed dice", () => {
  assert.deepEqual(parseAbilityDamageFormula("2d8+3"), { quantity: 2, sides: 8, formula: "0 +3" })
  assert.equal(parseAbilityDamageFormula("2d8 * 3"), undefined)
  assert.equal(parseAbilityDamageFormula("not dice"), undefined)
})
