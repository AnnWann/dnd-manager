import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
const output = await build({
  entryPoints: ['apps/web/src/models/abilities/AbilityRoll.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false,
})
const { validateAbilityRoll, resolveAbilityDamageFormula } = await import(
  'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].contents).toString('base64'),
)
const character = {
  get: () => ({ classes: [{ className: 'fighter', level: 3 }, { className: '__custom__-uuid', level: 2 }] }),
  getEffectiveAttributeModifier: () => 4,
}
const roll = dice => ({ kind: 'damage', damage: [{ id: 'heal', label: 'Cura', damageType: 'healing', dice }] })
test('legacy dice and signed modifiers still resolve', () => {
  assert.equal(validateAbilityRoll(roll('2d8 - 3')), undefined)
  assert.deepEqual(resolveAbilityDamageFormula('2d8 - 3', character), { quantity: 2, sides: 8, flat: -3 })
})
test('level and attribute formulas resolve from the authoritative character', () => {
  const expression = '1d6 + floor(character.level / 2) + character.attributeModifier.con'
  assert.equal(validateAbilityRoll(roll(expression), character), undefined)
  assert.deepEqual(resolveAbilityDamageFormula(expression, character), { quantity: 1, sides: 6, flat: 6 })
})
test('custom class identifiers with hyphens work', () => {
  const expression = '1d6 + character.class.__custom__-uuid.level'
  assert.equal(validateAbilityRoll(roll(expression), character), undefined)
  assert.equal(resolveAbilityDamageFormula(expression, character).flat, 2)
})
test('unknown variables, malformed expressions and unsupported dice are rejected', () => {
  for (const expression of ['1d6 + character.fake', '1d6 +', '1d6 * 3', '21d6', '1d7', '1d6 + 2d8']) {
    assert.ok(validateAbilityRoll(roll(expression), character), expression)
  }
})
test('formula bonuses remain separate from dice for critical resolution', () => {
  assert.deepEqual(resolveAbilityDamageFormula('1d6 + character.level', character), { quantity: 1, sides: 6, flat: 5 })
  assert.equal(resolveAbilityDamageFormula('1d6 + 100001', character), undefined)
})
