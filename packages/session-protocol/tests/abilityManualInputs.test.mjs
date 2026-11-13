import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
async function production(relative) {
  const built = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false,
    conditions: ['types'] })
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
}
const [{ CharacterTemplate }, { validateAbilityInputDefinitions, validateAbilityInputValues }, { parseAbilityClientMessage }, { evaluateCharacterSheetFormula, validateCharacterSheetFormula }] = await Promise.all([
  production('../../../apps/web/src/models/characters/CharacterTemplate.ts'),
  production('../../../apps/web/src/models/abilities/abilityManualInputs.ts'),
  production('../../../apps/session-server/src/routes/characters/abilities/abilityProtocol.ts'),
  production('../../../apps/web/src/lib/customSystems/CharacterSheetFormula.ts'),
])
const inputs = [{ id: 'nivelMagia', label: 'Nível da magia', min: 1, max: 9 }, { id: 'multiplicador', label: 'Multiplicador', min: 2, max: 3 }]
const formula = 'input.nivelMagia * input.multiplicador'
const harvest = { id: 'harvest', name: 'Colheita Sinistra', kind: 'passive', manualInputs: inputs, effectDuration: 'instant', bonuses: { onUseHp: [{ kind: 'heal', bonus: { type: 'add', value: 0, formula } }] } }
const character = (abilities = [harvest]) => CharacterTemplate.fromJSON({ id: 'aldren', name: 'Aldren', abilities, sheet: { HP: { max: 50, current: 10, temporary: 0 } } })
const use = (c, values, option) => c.useAbility('harvest', option, undefined, undefined, undefined, undefined, values)

test('Grim Harvest heals two or three times supplied spell level, every activation can differ', () => {
  const first = use(character(), { nivelMagia: 3, multiplicador: 2 })
  assert.equal(first.get('sheet').HP.current, 16)
  const next = use(first, { nivelMagia: 4, multiplicador: 3 })
  assert.equal(next.get('sheet').HP.current, 28)
  assert.equal(next.get('abilities')[0].bonuses.onUseHp[0].bonus.formula, formula)
  assert.equal(use(next, { nivelMagia: 9, multiplicador: 3 }).get('sheet').HP.current, 50)
})
test('missing, extra, nonfinite and out of bounds inputs do not mutate HP or spend uses', () => {
  const c = character([{ ...harvest, usage: { max: 2, used: 0, reset: 'longRest' } }])
  for (const values of [undefined, {}, { nivelMagia: 0, multiplicador: 2 }, { nivelMagia: 10, multiplicador: 2 }, { nivelMagia: NaN, multiplicador: 2 }, { nivelMagia: 3, multiplicador: 2, hack: 4 }]) {
    assert.ok(validateAbilityInputValues(harvest, values))
    assert.deepEqual(use(c, values).toJSON(), c.toJSON())
  }
})
test('selected option bonuses use inputs; a persisted character can activate again with new values', () => {
  const optionAbility = { ...harvest, bonuses: {}, activationOptions: [{ id: 'necromancy', name: 'Necromancia', bonuses: harvest.bonuses }] }
  const c = use(character([optionAbility]), { nivelMagia: 2, multiplicador: 3 }, 'necromancy')
  assert.equal(c.get('sheet').HP.current, 16)
  const restored = CharacterTemplate.fromJSON(JSON.parse(JSON.stringify(c.toJSON())))
  assert.equal(use(restored, { nivelMagia: 3, multiplicador: 2 }, 'necromancy').get('sheet').HP.current, 22)
})
test('formula context is per bonus and cannot override character variables', () => {
  const c = character()
  assert.equal(evaluateCharacterSheetFormula(formula, c, { nivelMagia: 3, multiplicador: 2 }), 6)
  assert.equal(evaluateCharacterSheetFormula(formula, c), undefined)
  assert.equal(validateCharacterSheetFormula(formula, c, { nivelMagia: 1, multiplicador: 2 }), undefined)
  assert.ok(validateCharacterSheetFormula('input.unknown + 2', c, { nivelMagia: 1 }))
  assert.equal(evaluateCharacterSheetFormula('character.hp.current + input.n', c, { n: 2, 'character.hp.current': 999 }), 12)
})
test('wire parser accepts bounded manual inputs and rejects executable or excess values', () => {
  const message = values => JSON.stringify({ type: 'session.abilities.operation', operation: { type: 'character.ability.use', characterId: 'aldren', source: { type: 'character', abilityId: 'harvest' }, resourceSelection: { inputValues: values } } })
  assert.ok(parseAbilityClientMessage(message({ nivelMagia: 3, multiplicador: 2 })))
  for (const value of [{ nivelMagia: '3' }, { nivelMagia: 100001 }, { 'x.y': 3 }, Array(13).fill(1), Object.fromEntries(Array.from({ length: 13 }, (_, i) => ['v' + i, i]))]) assert.equal(parseAbilityClientMessage(message(value)), null)
})
test('definition validation prevents duplicate IDs and invalid ranges', () => {
  assert.equal(validateAbilityInputDefinitions(inputs), undefined)
  for (const defs of [[...inputs, inputs[0]], [{ id: 'a.b', label: 'x' }], [{ id: 'a', label: 'x', min: 5, max: 2 }], [{ id: 'a', label: 'x', min: 1, max: 9, defaultValue: 10 }]]) assert.ok(validateAbilityInputDefinitions(defs))
})

test('manual values work alongside dice, with the formula bonus counted exactly once', () => {
  const ability = { ...harvest, bonuses: { onUseHp: [{ kind: 'heal', bonus: { type: 'add', value: 0, roll: { mode: 'manual', dice: '1d6', formula } } }] } }
  const next = character([ability]).useAbility('harvest', undefined, { 'onUseHp:0': 2 }, undefined, undefined, undefined, { nivelMagia: 3, multiplicador: 2 })
  assert.equal(next.get('sheet').HP.current, 18)
})
test('lasting effects retain separate manual values and update on subsequent activations', () => {
  const buff = (id) => ({ id, name: id, kind: 'active', manualInputs: [{ id: 'valor', label: 'Valor', min: 0, max: 10 }], effectDuration: 'lasting', bonuses: { attackBonus: [{ type: 'add', value: 0, formula: 'input.valor' }] } })
  const first = character([buff('a'), buff('b')]).useAbility('a', undefined, undefined, undefined, undefined, undefined, { valor: 5 })
  const next = first.useAbility('b', undefined, undefined, undefined, undefined, undefined, { valor: 2 })
  assert.equal(next.getEffectiveAttackBonus(0), 7)
  assert.equal(CharacterTemplate.fromJSON(JSON.parse(JSON.stringify(next.toJSON()))).getEffectiveAttackBonus(0), 7)
  const reactivated = next.deactivateAbility('a').useAbility('a', undefined, undefined, undefined, undefined, undefined, { valor: 1 })
  assert.equal(reactivated.getEffectiveAttackBonus(0), 3)
})
test('removing a referenced input is rejected instead of applying a stale fallback', () => {
  const broken = { ...harvest, manualInputs: [inputs[0]] }
  assert.ok(validateAbilityInputValues(broken, { nivelMagia: 3 }))
  const c = character([broken])
  assert.deepEqual(use(c, { nivelMagia: 3 }).toJSON(), c.toJSON())
})

test('activation modal renders external fields and the computed healing preview', async () => {
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  const require = createRequire(import.meta.url)
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const built = await build({
    entryPoints: [fileURLToPath(new URL('../../../apps/web/src/features/characters/abilities/abilityResourceActivationModal.tsx', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', write: false, conditions: ['types'], loader: { '.css': 'empty' },
    plugins: [{ name: 'activation-ui', setup(b) {
      b.onResolve({ filter: /^(?:react(?:-dom)?(?:\/.*)?|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
      b.onResolve({ filter: /CharacterWorkspaceContext$/ }, () => ({ path: 'workspace', namespace: 'ui-test' }))
      b.onResolve({ filter: /\/useSessionRuntime$/ }, () => ({ path: 'runtime', namespace: 'ui-test' }))
      b.onResolve({ filter: /\/Modal$/ }, () => ({ path: 'modal', namespace: 'ui-test' }))
      b.onLoad({ filter: /.*/, namespace: 'ui-test' }, args => ({ contents: args.path === 'workspace'
        ? 'export const useCharacterWorkspace=()=>({characters:[]})'
        : args.path === 'runtime' ? 'export const useOptionalSessionRuntime=()=>null'
        : 'import {createElement} from "react"; export const Modal=({children})=>createElement("div",null,children)' }))
    } }],
  })
  const { AbilityResourceActivationModal } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
  const ability = { ...harvest, manualInputs: [{ ...inputs[0], defaultValue: 3 }, { ...inputs[1], defaultValue: 2 }] }
  const html = renderToStaticMarkup(createElement(AbilityResourceActivationModal, { ability, character: character([ability]), onClose() {}, onConfirm() {} }))
  assert.ok(html.includes('Valores desta ativação'))
  assert.ok(html.includes('Nível da magia'))
  assert.ok(html.includes('Prévia — Cura: 6'))
  assert.ok(html.includes('value="3"'))
})

test('a formula invalid for the actual input cannot consume usage or apply its numeric fallback', () => {
  const ability = { ...harvest, manualInputs: [{ id: 'valor', label: 'Valor', min: 0, max: 9 }], usage: { max: 2, used: 0, reset: 'longRest' }, bonuses: { onUseHp: [{ kind: 'heal', bonus: { type: 'add', value: 999, formula: '10 / input.valor' } }] } }
  const c = character([ability])
  assert.deepEqual(use(c, { valor: 0 }).toJSON(), c.toJSON())
  assert.equal(use(c, { valor: 2 }).get('sheet').HP.current, 15)
})

test('an ASI feat grants skills and upgrades existing proficiency to expertise', async () => {
  const { getEffectiveSkillProficiency } = await production('../../../apps/web/src/models/characters/characterProficiencies.ts')
  const feat = {
    id: 'skill-feat', name: 'Talento', category: 'feat', kind: 'passive',
    grantedProficiencies: [
      { id: 'expert', category: 'skill', name: 'Atletismo', expertise: true },
      { id: 'grant', category: 'skill', name: 'Persuasão' },
    ],
  }
  const initial = character([]).withSheet('skills', { athletics: 'proficient' })
    .addProficiency({ id: 'existing', category: 'skill', name: 'athletics' })
  const asi = { id: 'choice', className: 'fighter', classLevel: 4, kind: 'feat', ability: feat, increases: {} }
  const withFeat = initial.with('asi', [asi])

  assert.equal(getEffectiveSkillProficiency(withFeat, 'athletics'), 'expertise')
  assert.equal(getEffectiveSkillProficiency(withFeat, 'persuasion'), 'proficient')
  assert.equal(getEffectiveSkillProficiency(withFeat.with('asi', []), 'athletics'), 'proficient')
  assert.equal(getEffectiveSkillProficiency(withFeat.with('asi', []), 'persuasion'), 'none')
  const inactive = initial.with('asi', [{ ...asi, ability: { ...feat, kind: 'active', benefitsActive: false } }])
  assert.equal(getEffectiveSkillProficiency(inactive, 'athletics'), 'proficient')
})

test('legacy Blefe and Enganação resolve to deception while Persuasão stays separate', async () => {
  const { getProficiencyDisplayName, resolveSkill } = await production('../../../apps/web/src/models/characters/applyManualProficiencies.ts')
  assert.equal(resolveSkill('Blefe'), 'deception')
  assert.equal(resolveSkill('Enganação'), 'deception')
  assert.equal(resolveSkill('Persuasão'), 'persuasion')
  assert.equal(getProficiencyDisplayName({ category: 'skill', name: 'Blefe' }), 'Enganação')
  assert.equal(getProficiencyDisplayName({ category: 'skill', name: 'persuasao' }), 'Persuasão')
})

test('removing manual skill proficiency clears legacy list entries while preserving granted sources', async () => {
  const { getEffectiveSkillProficiency, setManualSkillProficiency } = await production('../../../apps/web/src/models/characters/characterProficiencies.ts')
  const initial = character([]).withSheet('skills', { insight: 'none' }).withSheet('proficiencies', [
    { id: 'legacy-insight', category: 'skill', name: 'Intuição' },
    { id: 'duplicate-insight', category: 'skill', name: 'insight', expertise: true },
    { id: 'language', category: 'language', name: 'Comum' },
  ])
  assert.equal(getEffectiveSkillProficiency(initial, 'insight'), 'expertise')
  const reduced = setManualSkillProficiency(initial, 'insight', 'proficient')
  assert.equal(getEffectiveSkillProficiency(reduced, 'insight'), 'proficient')
  const removed = setManualSkillProficiency(reduced, 'insight', 'none')
  assert.equal(getEffectiveSkillProficiency(removed, 'insight'), 'none')
  assert.deepEqual(removed.get('sheet').proficiencies.map(entry => entry.id), ['language'])
  assert.equal(initial.get('sheet').proficiencies.length, 3)
  const racial = removed.withSheet('race', { ...removed.get('sheet').race, proficiencies: [
    { id: 'racial-insight', category: 'skill', name: 'Intuição' },
  ] })
  assert.equal(getEffectiveSkillProficiency(setManualSkillProficiency(racial, 'insight', 'none'), 'insight'), 'proficient')
})
