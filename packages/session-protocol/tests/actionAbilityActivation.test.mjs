import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { build } from 'esbuild'

// Exercise the Actions tab's real event handler with model dependencies intact.
// UI setters/session transport are injected, so no DOM or worker runtime is needed.
const componentUrl = new URL('../../../apps/web/src/features/characters/characterSheet/minimalCharacterActions.tsx', import.meta.url)
const source = await readFile(componentUrl, 'utf8')
const parsed = ts.createSourceFile('actions.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const imports = parsed.statements.filter(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text.includes('/models/')).map(node => node.getText(parsed)).join('\n')
let handler
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'changeAbilityState') handler = node.getText(parsed)
  ts.forEachChild(node, visit)
}
visit(parsed)
assert.ok(handler)
const compiled = await build({
  stdin: { contents: `${imports}
export { CharacterTemplate } from '../../../models/characters/CharacterTemplate';
export { abilityNeedsActivationDialog } from '../../../models/abilities/abilityActivationDialog';
export function makeHandler({ character, updateCharacter, sessionRuntime, setError = () => {}, setAbilityResourceEntry = () => {}, setSelected = () => {}, announce = () => {}, physicalDiceMode = false, selectedWeaponId = '' }) {
${handler}
return changeAbilityState;
}`, resolveDir: fileURLToPath(new URL('.', componentUrl)), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'],
})
const { CharacterTemplate, makeHandler, abilityNeedsActivationDialog } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
const harvest = { id: 'harvest', name: 'Colheita Sinistra', kind: 'passive', effectDuration: 'instant', manualInputs: [{ id: 'nivelMagia', label: 'Nível da magia', min: 1, max: 9 }], bonuses: { onUseHp: [{ kind: 'heal', bonus: { type: 'add', value: 0, formula: 'input.nivelMagia * 2' } }] } }
const entry = (ability = harvest, abilitySource = { type: 'character', abilityId: 'harvest' }) => ({ id: 'harvest', ability, abilitySource })
const character = () => CharacterTemplate.fromJSON({ id: 'aldren', abilities: [harvest], sheet: { HP: { max: 50, current: 10, temporary: 0 } } })

test('Actions and Abilities share the activation dialog requirement, including manual inputs and options', async () => {
  for (const ability of [harvest, { id: 'option', activationOptions: [{ id: 'a', name: 'A' }] }, { id: 'target', targeting: { mode: 'targets' } }, { id: 'point', targeting: { mode: 'point' } }]) assert.equal(abilityNeedsActivationDialog(ability), true)
  assert.equal(abilityNeedsActivationDialog({ id: 'simple', name: 'Simple', kind: 'active' }), false)
  for (const url of [componentUrl, new URL('../../../apps/web/src/features/characters/abilities/characterAbilities.tsx', import.meta.url)]) assert.match(await readFile(url, 'utf8'), /abilityNeedsActivationDialog\(/)
})

test('Actions applies Grim Harvest healing using manual values instead of silently closing', () => {
  let current = character()
  const errors = []
  const use = makeHandler({ character: current, updateCharacter: (_, updater) => { current = updater(current) }, setError: message => errors.push(message) })
  use(entry(), 'use', undefined, { inputValues: { nivelMagia: 3 } })
  assert.equal(current.get('sheet').HP.current, 16)
  assert.deepEqual(errors, [])
})

test('Actions keeps invalid activation open without updating the character', () => {
  let updated = false, reopened = false
  const errors = []
  makeHandler({ character: character(), updateCharacter: () => { updated = true }, setError: message => errors.push(message), setAbilityResourceEntry: value => { reopened = Boolean(value) } })(entry(), 'use')
  assert.equal(updated, false)
  assert.equal(reopened, true)
  assert.match(errors[0], /Nível da magia/)
})

test('Actions sends manual values and target selection to the authoritative session', () => {
  let operation
  const c = character()
  const use = makeHandler({ character: c, updateCharacter: () => assert.fail('session must own updates'), sessionRuntime: { status: 'connected', dispatchAbilityOperation: value => { operation = value; return true } } })
  use(entry(), 'use', undefined, { inputValues: { nivelMagia: 4 } }, undefined, undefined, ['character:target'], 'Proa')
  assert.deepEqual(operation.resourceSelection.inputValues, { nivelMagia: 4 })
  assert.deepEqual(operation.targetRefs, ['character:target'])
  assert.equal(operation.pointLabel, 'Proa')
  assert.equal(c.get('sheet').HP.current, 10)
})

for (const kind of ['race', 'equipment']) test(`Actions forwards manual values for ${kind} abilities`, () => {
  let current = character().with('abilities', [])
  if (kind === 'race') current = current.withSheet('race', { ...current.get('sheet').race, naturalAbilities: [harvest] })
  else current = current.with('equipment', { ...current.get('equipment'), weapons: [{ id: 'wand', name: 'Wand', abilities: [harvest] }] })
  const use = makeHandler({ character: current, updateCharacter: (_, updater) => { current = updater(current) } })
  use(entry(harvest, { type: kind, abilityId: 'harvest', itemId: 'wand' }), 'use', undefined, { inputValues: { nivelMagia: 2 } })
  assert.equal(current.get('sheet').HP.current, 14)
})
