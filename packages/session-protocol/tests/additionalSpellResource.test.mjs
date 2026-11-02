import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const root = new URL('../../../', import.meta.url)
const built = await build({
  stdin: { contents: `export { CharacterTemplate } from './apps/web/src/models/characters/CharacterTemplate'; export * from './apps/web/src/models/magic/spells/additionalSpellResource'; export { getCharacterGrantedSpells } from './apps/web/src/models/characters/characterGrantedSpells';`, resolveDir: fileURLToPath(root), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'],
})
const { CharacterTemplate, paySpellSlotAndAdditionalResource: pay, additionalSpellResourceError, getCharacterGrantedSpells } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
const counter = (id = 'pool', used = 0) => ({ id, name: id, kind: 'passive', usage: { max: 5, used, reset: 'longRest', sharedResourceId: 'mana' } })
const character = (abilities = [counter()], current = 2) => CharacterTemplate.fromJSON({
  id: 'caster', sheet: { type: 'npc' }, abilities,
  magic: { spells: { knownSpells: [], slots: { 1: { level: 1, max: 2, current }, 2: { level: 2, max: 2, current } }, pactSlots: { level: 2, max: 2, current } } },
})
const cost = { resourceId: 'mana', amount: 2 }
const slot = { type: 'slot', pool: 'normal', level: 1 }

test('spends a normal slot and the additional counter in one immutable payment', () => {
  const original = character()
  const result = pay(original, { slotLevel: 1 }, cost, 1, slot)
  assert.equal(result.ok, true)
  assert.equal(result.character.getSpellSlots()[1].current, 1)
  assert.equal(result.character.get('abilities')[0].usage.used, 2)
  assert.equal(original.getSpellSlots()[1].current, 2)
  assert.equal(original.get('abilities')[0].usage.used, 0)
})

test('insufficient slots or resource never consumes either cost', () => {
  for (const c of [character(undefined, 0), character([counter('pool', 4)])]) {
    const before = JSON.stringify(c.toJSON())
    assert.equal(pay(c, { slotLevel: 1 }, cost, 1, slot).ok, false)
    assert.equal(JSON.stringify(c.toJSON()), before)
  }
})

test('cannot bypass combined costs with free or alternative resource payments', () => {
  for (const payment of [{ type: 'none' }, { type: 'resource', resource: 'ki', amount: 1 }, { type: 'equipment' }, { ...slot, level: 2 }, { ...slot, pool: 'invalid' }]) {
    assert.equal(pay(character(), { slotLevel: 1 }, cost, 1, payment).ok, false)
  }
})

test('cantrips spend only the additional resource', () => {
  const result = pay(character(undefined, 0), { slotLevel: 0 }, cost, 0, { type: 'none' })
  assert.equal(result.ok, true)
  assert.equal(result.character.get('abilities')[0].usage.used, 2)
  assert.equal(result.character.getSpellSlots()[1].current, 0)
  assert.equal(pay(character(), { slotLevel: 0 }, cost, 1, slot).ok, false)
})

for (const pool of ['normal', 'pact']) test(`upcast with ${pool} slots keeps the fixed additional cost`, () => {
  const result = pay(character(), { slotLevel: 1 }, cost, 2, { type: 'slot', pool, level: 2 })
  assert.equal(result.ok, true)
  assert.equal(pool === 'pact' ? result.character.getPactSlots().current : result.character.getSpellSlots()[2].current, 1)
  assert.equal(result.character.get('abilities')[0].usage.used, 2)
})

test('direct ability ID resolves and synchronizes shared aliases once', () => {
  const result = pay(character([counter('first', 1), counter('second', 2)]), { slotLevel: 1 }, { resourceId: 'first', amount: 1 }, 1, slot)
  assert.equal(result.ok, true)
  assert.deepEqual(result.character.get('abilities').map(a => a.usage.used), [3, 3])
})

test('missing IDs and invalid amounts fail closed', () => {
  for (const invalid of [{ resourceId: '', amount: 1 }, { resourceId: 'missing', amount: 1 }, { resourceId: 'mana', amount: -1 }, { resourceId: 'mana', amount: 1.5 }, { resourceId: 'mana', amount: NaN }]) {
    assert.ok(additionalSpellResourceError(character(), invalid))
    assert.equal(pay(character(), { slotLevel: 1 }, invalid, 1, slot).ok, false)
  }
})

test('grant survives JSON roundtrip and projects as learned with cumulative cost', () => {
  const c = character([{ ...counter(), grantedSpells: [{ index: 'infestation', castingMode: 'known', additionalResourceCost: cost }] }])
  const grants = getCharacterGrantedSpells(CharacterTemplate.fromJSON(JSON.parse(JSON.stringify(c.toJSON()))))
  assert.equal(grants.length, 1)
  assert.equal(grants[0].castingMode, 'known')
  assert.deepEqual(grants[0].additionalResourceCost, cost)
  assert.equal(grants[0].usage, undefined)
  assert.equal(grants[0].resourceCost, undefined)
})

// Bundle the actual server functions without changing their production visibility.
const { readFile } = await import('node:fs/promises')
const actorUrl = new URL('../../../apps/session-server/src/routes/characters/spells/MagicSessionActor.ts', import.meta.url)
const serverBuilt = await build({
  plugins: [{ name: 'worker-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'workers', namespace: 'worker-test' }))
    b.onLoad({ filter: /.*/, namespace: 'worker-test' }, () => ({ contents: 'export class DurableObject {}' }))
  } }],
  stdin: { contents: await readFile(actorUrl, 'utf8') + '\nexport { resolveCastSource, applySpellCastPayment };', resolveDir: fileURLToPath(new URL('.', actorUrl)), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'],
})
const { resolveCastSource, applySpellCastPayment } = await import('data:text/javascript;base64,' + Buffer.from(serverBuilt.outputFiles[0].contents).toString('base64'))

test('server enforces extra cost for the matching learned grant and preserves independent sources', () => {
  let c = character([{ ...counter(), grantedSpells: [{ index: 'test-spell', castingMode: 'known', additionalResourceCost: cost }] }])
  const grant = getCharacterGrantedSpells(c)[0]
  const spell = { index: 'test-spell', slotLevel: 1 }
  c = c.with('magic', { ...c.get('magic'), spells: { ...c.get('magic').spells, knownSpells: [
    { spells: { id: spell.index, prepared: true }, source: grant.source },
    { spells: { id: spell.index, prepared: true }, source: { type: 'class', sourceId: 'wizard', name: 'wizard', attribute: 'int' } },
  ] } })
  const restricted = resolveCastSource(c, spell, grant.source.sourceId)
  assert.equal(restricted.ok, true)
  assert.deepEqual(restricted.grant.additionalResourceCost, cost)
  assert.equal(applySpellCastPayment(c, spell, restricted.grant, 1, { type: 'none' }).ok, false)
  const paid = applySpellCastPayment(c, spell, restricted.grant, 1, slot)
  assert.equal(paid.ok, true)
  assert.equal(paid.character.get('abilities')[0].usage.used, 2)
  const independent = resolveCastSource(c, spell, 'wizard')
  assert.equal(independent.ok, true)
  assert.equal(independent.grant, undefined)
  const normal = applySpellCastPayment(c, spell, independent.grant, 1, slot)
  assert.equal(normal.ok, true)
  assert.equal(normal.character.get('abilities')[0].usage.used, 0)
})
