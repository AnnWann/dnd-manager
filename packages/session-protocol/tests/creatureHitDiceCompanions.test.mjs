import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
async function load(path) {
  const built = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true,
    format: 'esm', platform: 'node', write: false,
    alias: { '@dnd-manager/game-core/manual-dice': fileURLToPath(new URL('../../game-core/src/manualDiceExpression.ts', import.meta.url)) } })
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
}
const { normalizeCompendiumCreature, createCompendiumCreature } = await load('../../../apps/web/src/models/creatures/CompendiumCreature.ts')
const { inferCreatureHitDice, normalizeCreatureHitDice } = await load('../../../apps/web/src/models/creatures/CreatureHitDice.ts')
const { visibleRuntimeConfigSnapshot } = await load('../../../apps/session-server/src/routes/session/runtimeConfigAccess.ts')

test('old creatures gain hit dice without changing HP, and explicit formulas survive', () => {
  for (const maxHp of [0, 1, 7, 34, 105, 350]) {
    const creature = normalizeCompendiumCreature({ name: 'Teste', maxHp, size: 'Médio', challengeRating: '5', abilityScores: { con: 16 } })
    assert.equal(creature.maxHp, maxHp)
    const [, count, sides, bonus] = creature.hitDice.match(/^(\d+)d(\d+)([+-]\d+)?$/)
    assert.equal(Math.floor(Number(count) * (Number(sides) + 1) / 2) + Number(bonus ?? 0), maxHp)
    assert.deepEqual(normalizeCompendiumCreature(creature), creature)
  }
  assert.equal(normalizeCompendiumCreature({ name: 'Teste', maxHp: 105, hitDice: ' 14d8 + 42 ' }).hitDice, '14d8+42')
})
test('ND is a fallback without HP; size selects die and invalid input is rejected', () => {
  assert.equal(inferCreatureHitDice({ challengeRating: '5', size: 'Grande' }), '6d10')
  assert.equal(inferCreatureHitDice({ challengeRating: '1/4', size: 'Miúdo' }), '2d4')
  assert.equal(inferCreatureHitDice({ challengeRating: 'unknown', size: 'Médio' }), '1d8')
  for (const value of ['0d8', '2001d8', '1d7', '1d8+alert(1)', '']) assert.equal(normalizeCreatureHitDice(value), undefined)
})
test('companion is the default, explicit familiars and mounts remain unchanged', () => {
  assert.equal(createCompendiumCreature({ name: 'NPC' }).controlKind, 'companion')
  assert.equal(normalizeCompendiumCreature({ name: 'NPC' }).controlKind, 'companion')
  for (const controlKind of ['familiar', 'mount']) assert.equal(normalizeCompendiumCreature({ name: 'NPC', controlKind }).controlKind, controlKind)
})
test('gallery sends only opted-in portraits; player never receives unowned sheets', () => {
  const npc = normalizeCompendiumCreature({ id: 'npc', name: 'Rosa', maxHp: 99, showInCompanions: true, imageUrl: 'https://example.com/rosa.png', combatNotes: 'segredo', drops: { guaranteed: [{ name: 'Tesouro' }] } })
  const hidden = normalizeCompendiumCreature({ id: 'hidden', name: 'Vilão', showInCompanions: false })
  const owned = normalizeCompendiumCreature({ id: 'owl', name: 'Coruja', controlKind: 'familiar', ownerUserId: 'player' })
  const snapshot = { creationRevision: 1, config: { characters: [], spells: [], customSystems: [], creatureCompendium: [npc, hidden, owned], companionPortraits: [{ id: 'bad', name: 'spoiler', armorClass: 20 }] } }
  const player = visibleRuntimeConfigSnapshot({ role: 'PLAYER', userId: 'player', ownedCharacterIds: [] }, snapshot)
  assert.deepEqual(player.config.companionPortraits, [{ id: 'npc', name: 'Rosa', imageUrl: 'https://example.com/rosa.png' }])
  assert.deepEqual(player.config.creatureCompendium.map(c => c.id), ['owl'])
  assert.ok(!JSON.stringify(player).includes('segredo'))
  assert.strictEqual(visibleRuntimeConfigSnapshot({ role: 'MASTER', userId: 'dm' }, snapshot), snapshot)
  assert.equal(npc.maxHp, 99)
})

test('companion gallery renders only names and portraits without sheet controls', async () => {
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  const require = createRequire(import.meta.url)
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const built = await build({
    entryPoints: [fileURLToPath(new URL('../../../apps/web/src/views/CompanionsView.tsx', import.meta.url))],
    bundle: true, format: 'esm', platform: 'node', write: false, jsx: 'automatic',
    plugins: [{ name: 'gallery-runtime', setup(b) {
      b.onResolve({ filter: /^(?:react(?:\/.*)?|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
      b.onResolve({ filter: /\/useSessionRuntime$/ }, () => ({ path: 'runtime', namespace: 'gallery-test' }))
      b.onLoad({ filter: /.*/, namespace: 'gallery-test' }, () => ({ contents: 'export const useOptionalSessionRuntime = () => globalThis.__companionGalleryRuntime' }))
    } }],
  })
  const { CompanionsView } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
  globalThis.__companionGalleryRuntime = { runtimeConfigSnapshot: { config: {
    companionPortraits: [{ id: 'rosa', name: 'Capitão Rosa', imageUrl: 'https://example.com/rosa.png' }],
    creatureCompendium: [{ name: 'Nome secreto', maxHp: 99, combatNotes: 'Segredo' }],
  } } }
  try {
    const html = renderToStaticMarkup(createElement(CompanionsView))
    assert.ok(html.includes('Capitão Rosa'))
    assert.ok(html.includes('https://example.com/rosa.png'))
    assert.ok(!html.includes('Nome secreto'))
    assert.ok(!html.includes('Segredo'))
    assert.ok(!html.includes('<button'))
  } finally {
    delete globalThis.__companionGalleryRuntime
  }
})
