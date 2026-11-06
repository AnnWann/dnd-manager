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
      b.onResolve({ filter: /^(?:react(?:-dom)?(?:\/.*)?|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
      b.onResolve({ filter: /\/useSessionRuntime$/ }, () => ({ path: 'runtime', namespace: 'gallery-test' }))
      b.onResolve({ filter: /CreatureStateDialog$/ }, () => ({ path: 'dialog', namespace: 'gallery-test' }))
      b.onResolve({ filter: /\/sessionCompanions$/ }, () => ({ path: 'service', namespace: 'gallery-test' }))
      b.onLoad({ filter: /.*/, namespace: 'gallery-test' }, args => ({ contents: args.path === 'dialog' ? 'export const CreatureStateDialog = () => null' : args.path === 'service' ? 'export const saveSessionCompanionVisibility = async () => {}' : 'export const useOptionalSessionRuntime = () => globalThis.__companionGalleryRuntime' }))
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

test('automatic challenge drives proficiency and XP while manual values remain available', async () => {
  const { creatureDefeatXp } = await load('../../../apps/web/src/models/creatures/CreatureChallenge.ts')
  const { getCreatureProficiencyBonusFromChallengeRating } = await load('../../../apps/web/src/models/creatures/CompendiumCreature.ts')
  const creature = normalizeCompendiumCreature({
    name: 'Teste', challengeRating: '2', maxHp: 140, armorClass: 15,
    challengeEstimate: { damagePerRound: 36, accuracy: 6, accuracyKind: 'attack', hpMultiplier: 1 },
  })
  assert.equal(creature.challengeRating, '5')
  assert.equal(getCreatureProficiencyBonusFromChallengeRating(creature.challengeRating), 3)
  assert.equal(creatureDefeatXp(creature), 1800)
  assert.equal(creatureDefeatXp(normalizeCompendiumCreature({ ...creature, defeatXp: 0 })), 0)
  assert.equal(creatureDefeatXp(normalizeCompendiumCreature({
    ...creature, challengeEstimate: undefined, challengeRating: '0,25',
  })), 50)
})

test('challenge uses sheet damage, allows multiple actions, and follows changes to the sheet', async () => {
  const { estimateCreatureChallenge } = await load('../../../apps/web/src/models/creatures/CreatureChallenge.ts')
  const { duplicateCompendiumCreature } = await load('../../../apps/web/src/models/creatures/CompendiumCreature.ts')
  const attack = (id, formula, usage) => ({
    id, name: id, usage, mechanics: { kind: 'attack', attackBonus: 6, damage: [
      { formula, damageType: 'piercing' },
      { formula: '10d6', damageType: 'fire', optional: true },
    ] },
  })
  const creature = normalizeCompendiumCreature({
    name: 'Teste', maxHp: 100, armorClass: 15,
    actions: [attack('mordida', '2d8+4'), attack('garra', '1d6+2'), attack('limitado', '12d6', { max: 1 })],
    challengeEstimate: { damagePerRound: 0, accuracy: 3, accuracyKind: 'attack', hpMultiplier: 1, offenseSource: 'sheet' },
  })
  assert.equal(estimateCreatureChallenge(creature).damage, 13)
  assert.equal(estimateCreatureChallenge(creature).effectiveHp, 100)

  const custom = normalizeCompendiumCreature({
    ...creature,
    challengeEstimate: { ...creature.challengeEstimate, routine: { mordida: 1, garra: 2 }, hpMultiplier: 1.5 },
  })
  assert.equal(estimateCreatureChallenge(custom).damage, 24)
  assert.equal(estimateCreatureChallenge(custom).effectiveHp, 150)
  assert.equal(estimateCreatureChallenge(duplicateCompendiumCreature(custom)).damage, 24)
  assert.equal(estimateCreatureChallenge({ ...custom, actions: [attack('mordida', '3d8+4'), custom.actions[1]] }).damage, 28.5)
})
