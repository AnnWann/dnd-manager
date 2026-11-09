import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const root = new URL('../../../', import.meta.url)
const built = await build({
  stdin: { contents: `export { CharacterTemplate } from './apps/web/src/models/characters/CharacterTemplate'; export * from './apps/web/src/models/magic/spells/additionalSpellResource'; export { getCharacterGrantedSpells, spendGrantedSpellAbilityUse } from './apps/web/src/models/characters/characterGrantedSpells';`, resolveDir: fileURLToPath(root), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'],
})
const { CharacterTemplate, paySpellSlotAndAdditionalResource: pay, additionalSpellResourceError, getAdditionalSpellResourceRecovery, getCharacterGrantedSpells, spendGrantedSpellAbilityUse } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
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

for (const [reset, expected] of [
  ['shortRest', 'Descanso curto ou longo.'],
  ['longRest', 'Descanso longo.'],
  ['limited', 'Reposição manual; não recupera ao descansar.'],
  ['turn', 'A cada turno.'],
]) test(`additional resource recovery describes ${reset} even when depleted`, () => {
  const ability = counter('pool', 5)
  ability.usage.reset = reset
  assert.equal(getAdditionalSpellResourceRecovery(character([ability]), cost), expected)
})

test('additional resource recovery uses the same linked ID and reports missing counters', () => {
  const ability = counter()
  ability.usage.reset = 'cooldown'
  ability.usage.cooldownAmount = 2
  ability.usage.cooldownUnit = 'minutes'
  assert.equal(getAdditionalSpellResourceRecovery(character([ability]), { resourceId: 'pool', amount: 1 }), 'Após o cooldown de 2 minuto(s).')
  assert.match(getAdditionalSpellResourceRecovery(character(), { resourceId: 'unknown', amount: 1 }), /Recurso não encontrado/)
})

const eitherCost = { ...cost, mode: 'oneOf' }
test('OR spends only the selected counter, without requiring a spell slot', () => {
  const c = character(undefined, 0)
  const result = pay(c, { slotLevel: 1 }, eitherCost, 1, { type: 'linked-resource' })
  assert.equal(result.ok, true)
  assert.equal(result.character.get('abilities')[0].usage.used, 2)
  assert.equal(result.character.getSpellSlots()[1].current, 0)
})

test('OR spends only the selected slot, even when the counter is exhausted or absent', () => {
  for (const c of [character([counter('pool', 5)]), character([])]) {
    const result = pay(c, { slotLevel: 1 }, eitherCost, 2, { ...slot, level: 2 })
    assert.equal(result.ok, true)
    assert.equal(result.character.getSpellSlots()[2].current, 1)
    assert.deepEqual(result.character.get('abilities'), c.get('abilities'))
  }
})

test('AND cannot be bypassed using resource-only payment', () => {
  assert.equal(pay(character(), { slotLevel: 1 }, cost, 1, { type: 'linked-resource' }).ok, false)
})

test('OR rejects free noncantrip casts and resource-only upcasting', () => {
  for (const [level, payment] of [[1, { type: 'none' }], [2, { type: 'linked-resource' }]]) {
    assert.equal(pay(character(), { slotLevel: 1 }, eitherCost, level, payment).ok, false)
  }
  const c = character([counter('pool', 5)])
  assert.equal(pay(c, { slotLevel: 1 }, eitherCost, 1, { type: 'linked-resource' }).ok, false)
  assert.equal(c.getSpellSlots()[1].current, 2)
})

test('OR cantrip can use its ordinary free casting or the optional counter', () => {
  const free = pay(character([counter('pool', 5)]), { slotLevel: 0 }, eitherCost, 0, { type: 'none' })
  assert.equal(free.ok, true)
  assert.equal(free.character.get('abilities')[0].usage.used, 5)
  const paid = pay(character(), { slotLevel: 0 }, eitherCost, 0, { type: 'linked-resource' })
  assert.equal(paid.ok, true)
  assert.equal(paid.character.get('abilities')[0].usage.used, 2)
})

test('server accepts linked resource only for the matching OR grant', () => {
  const c = character([{ ...counter(), grantedSpells: [{ index: 'test', castingMode: 'known', additionalResourceCost: eitherCost }] }])
  const spell = { index: 'test', slotLevel: 1 }
  const grant = getCharacterGrantedSpells(c)[0]
  const result = applySpellCastPayment(c, spell, grant, 1, { type: 'linked-resource' })
  assert.equal(result.ok, true)
  assert.equal(result.character.getSpellSlots()[1].current, 2)
  assert.equal(result.character.get('abilities')[0].usage.used, 2)
  assert.equal(applySpellCastPayment(c, spell, undefined, 1, { type: 'linked-resource' }).ok, false)
})

const protocolBuilt = await build({ entryPoints: [fileURLToPath(new URL('../../../apps/session-server/src/routes/characters/spells/magicProtocol.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'] })
const { parseMagicClientMessage } = await import('data:text/javascript;base64,' + Buffer.from(protocolBuilt.outputFiles[0].contents).toString('base64'))
test('magic protocol accepts a linked-resource choice without client-supplied cost', () => {
  const operation = { type: 'character.spell.cast', characterId: 'caster', requestId: 'request', spellIndex: 'test', sourceId: 'pool', castLevel: 1, mode: 'normal', payment: { type: 'linked-resource' } }
  const parsed = parseMagicClientMessage(JSON.stringify({ type: 'session.magic.operation', operation }))
  assert.equal(parsed.operation.payment.type, 'linked-resource')
})

const actionsUrl = new URL('../../../apps/web/src/features/characters/characterSheet/minimalMagicActions.tsx', import.meta.url)
const actionsSource = await readFile(actionsUrl, 'utf8')
const choicesSource = actionsSource.slice(actionsSource.indexOf('function getResourceChoices('), actionsSource.indexOf('function buildAvailableSpells('))
const resolverSource = actionsSource.slice(actionsSource.indexOf('  function resolveAuthoritativeCastPayment()'), actionsSource.indexOf('  const linkedResourceError ='))
const choicesBuilt = await build({ stdin: { contents: `import { additionalSpellResourceError } from '../../../models/magic/spells/additionalSpellResource'; export ${choicesSource} export function makeResolver(selected, castingResource, setError) { ${resolverSource}; return resolveAuthoritativeCastPayment }`, loader: 'ts', resolveDir: fileURLToPath(new URL('.', actionsUrl)) }, bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'] })
const { getResourceChoices, makeResolver } = await import('data:text/javascript;base64,' + Buffer.from(choicesBuilt.outputFiles[0].contents).toString('base64'))
test('cast dialog offers separate OR choices and disables only the unavailable payment', () => {
  const entry = { spell: { slotLevel: 1 }, additionalResourceCost: eitherCost }
  const exhaustedResource = getResourceChoices(character([counter('pool', 5)]), entry, [{ level: 1, pool: 'normal' }])
  assert.deepEqual(exhaustedResource.map(choice => [choice.value, choice.disabled]), [['slot', false], ['linked', true]])
  const exhaustedSlots = getResourceChoices(character(undefined, 0), entry, [])
  assert.deepEqual(exhaustedSlots.map(choice => [choice.value, choice.disabled]), [['slot', true], ['linked', false]])
})

test('cast dialog sends the resource-only choice at base level and rejects it for AND', () => {
  const errors = []
  const selected = { spell: { slotLevel: 1 }, additionalResourceCost: eitherCost }
  const resolved = makeResolver(selected, 'linked', value => errors.push(value))()
  assert.deepEqual(resolved, { castLevel: 1, payment: { type: 'linked-resource' } })
  assert.equal(makeResolver({ ...selected, additionalResourceCost: cost }, 'linked', value => errors.push(value))(), null)
  assert.equal(errors.length, 1)
})

test('ability-granted spells consume their individual costs and retain the default of one', () => {
  const source = character([{ ...counter('arcane-eye'), grantedSpells: [
    { index: 'disintegrate', castingMode: 'source', abilityChargeCost: 4 },
    { index: 'clairvoyance', castingMode: 'source', abilityChargeCost: 2 },
    { index: 'crown-of-madness', castingMode: 'source' },
  ] }])
  const grants = getCharacterGrantedSpells(CharacterTemplate.fromJSON(JSON.parse(JSON.stringify(source.toJSON()))))
  assert.deepEqual(grants.map(grant => grant.abilityChargeCost ?? 1), [4, 2, 1])
  const afterFour = spendGrantedSpellAbilityUse(source, grants[0].usageSource, grants[0].abilityChargeCost)
  assert.equal(afterFour.get('abilities')[0].usage.used, 4)
  const exhausted = spendGrantedSpellAbilityUse(afterFour, grants[1].usageSource, grants[1].abilityChargeCost)
  assert.equal(exhausted.get('abilities')[0].usage.used, 4)
  assert.equal(source.get('abilities')[0].usage.used, 0)
})

test('server enforces variable charge costs atomically for ability-granted spells', () => {
  const source = character([{ ...counter('arcane-eye'), grantedSpells: [
    { index: 'disintegrate', castingMode: 'source', abilityChargeCost: 4 },
    { index: 'clairvoyance', castingMode: 'source', abilityChargeCost: 2 },
  ] }])
  const spell = { index: 'disintegrate', slotLevel: 6 }
  const grant = getCharacterGrantedSpells(source)[0]
  const payment = { type: 'ability-use', source: grant.usageSource }
  const spent = applySpellCastPayment(source, spell, grant, 6, payment)
  assert.equal(spent.ok, true)
  assert.equal(spent.character.get('abilities')[0].usage.used, 4)
  const before = JSON.stringify(spent.character.toJSON())
  const refused = applySpellCastPayment(spent.character, { index: 'clairvoyance', slotLevel: 3 }, getCharacterGrantedSpells(spent.character)[1], 3, payment)
  assert.equal(refused.ok, false)
  assert.equal(JSON.stringify(spent.character.toJSON()), before)
})

test('granted spells honor both parent ability and individual spell requirements', () => {
  const parent = {
    ...counter('vecna-eye'),
    unlockRequirements: { minimumCharacterLevel: 7 },
    grantedSpells: [
      { index: 'clairvoyance', castingMode: 'source', unlockRequirements: { minimumCharacterLevel: 9 } },
      { index: 'disintegrate', castingMode: 'source', unlockRequirements: { attribute: 'int', minimumAttributeScore: 18 } },
      { index: 'eyebite', castingMode: 'source' },
    ],
  }
  const mk = (level, int) => CharacterTemplate.fromJSON({
    id: 'vecna-caster',
    sheet: { type: 'pc', classes: [{ className: 'wizard', level }], attributes: { str: 10, dex: 10, con: 10, int, wis: 10, cha: 10 } },
    abilities: [parent],
  })
  assert.deepEqual(getCharacterGrantedSpells(mk(5, 20)).map(grant => grant.index), [])
  assert.deepEqual(getCharacterGrantedSpells(mk(7, 16)).map(grant => grant.index), ['eyebite'])
  assert.deepEqual(getCharacterGrantedSpells(mk(9, 16)).map(grant => grant.index), ['clairvoyance', 'eyebite'])
  assert.deepEqual(getCharacterGrantedSpells(mk(9, 18)).map(grant => grant.index), ['clairvoyance', 'disintegrate', 'eyebite'])
})
