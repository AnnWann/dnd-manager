import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
async function bundle(relative, plugins) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'], jsx: 'automatic', plugins })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))
}
const mocks = { name: 'companion-api', setup(b) {
  b.onResolve({ filter: /\/api\/creation$/ }, () => ({ path: 'creation', namespace: 'test-api' }))
  b.onResolve({ filter: /\/api\/spell-compendium$/ }, () => ({ path: 'spells', namespace: 'test-api' }))
  b.onLoad({ filter: /.*/, namespace: 'test-api' }, args => ({ contents: args.path === 'creation' ? 'export const getCreationSnapshot = (...args) => globalThis.companionApi.get(...args); export const saveCreationSnapshot = (...args) => globalThis.companionApi.save(...args)' : 'export const getOfficialSpellsByIndexes = async () => []' }))
} }
const { saveSessionCompanionVisibility } = await bundle('../../../apps/web/src/features/creatures/sessionCompanions.ts', [mocks])
const { createCompendiumCreature } = await bundle('../../../apps/web/src/models/creatures/CompendiumCreature.ts', [])
const creature = createCompendiumCreature({ id: 'nessa', name: 'Nessa', sheetImageUrl: 'https://example.com/nessa.png', description: 'SECRET SHEET' })
const other = createCompendiumCreature({ id: 'other', name: 'Other' })
function fixture() {
  const state = { version: 1, characters: [], spells: [], customSystems: [], itemCompendium: [], creatureCompendium: [creature, other], creatureFolders: ['NPCs'] }
  let saved
  globalThis.companionApi = {
    get: async (campaign, options) => { assert.equal(campaign, 'campaign'); assert.equal(options.force, true); return { revision: 7, data: state } },
    save: async (campaign, revision, data) => { assert.equal(campaign, 'campaign'); assert.equal(revision, 7); saved = data; return { revision: 8, data } },
  }
  return { state, get saved() { return saved } }
}
test('adding a companion saves only visibility against the latest revision and publishes portraits', async () => {
  const f = fixture()
  const snapshot = await saveSessionCompanionVisibility('campaign', 'nessa', true, [])
  assert.equal(snapshot.creationRevision, 8)
  assert.equal(f.saved.creatureCompendium[0].showInCompanions, true)
  assert.equal(f.state.creatureCompendium[0].showInCompanions, false)
  assert.deepEqual(f.saved.creatureCompendium[1], other)
  assert.deepEqual(f.saved.creatureFolders, ['NPCs'])
  assert.deepEqual(snapshot.config.companionPortraits, [{ id: 'nessa', name: 'Nessa', imageUrl: 'https://example.com/nessa.png' }])
  assert.equal(JSON.stringify(snapshot.config.companionPortraits).includes('SECRET'), false)
})
test('removing a companion hides the portrait without deleting its creature', async () => {
  const f = fixture()
  f.state.creatureCompendium[0] = { ...creature, showInCompanions: true }
  const snapshot = await saveSessionCompanionVisibility('campaign', 'nessa', false, [])
  assert.equal(f.saved.creatureCompendium.length, 2)
  assert.equal(f.saved.creatureCompendium[0].showInCompanions, false)
  assert.deepEqual(snapshot.config.companionPortraits, [])
})
test('missing creatures and revision conflicts cannot silently overwrite campaign data', async () => {
  const f = fixture()
  await assert.rejects(saveSessionCompanionVisibility('campaign', 'missing', true, []), /não está mais/)
  assert.equal(f.saved, undefined)
  globalThis.companionApi.save = async () => { throw new Error('revision conflict') }
  await assert.rejects(saveSessionCompanionVisibility('campaign', 'nessa', true, []), /revision conflict/)
})
const uiMocks = { name: 'companion-view', setup(b) {
  b.onResolve({ filter: /useSessionRuntime$/ }, () => ({ path: 'runtime', namespace: 'test-ui' }))
  b.onResolve({ filter: /sessionCompanions$/ }, () => ({ path: 'service', namespace: 'test-ui' }))
  b.onLoad({ filter: /.*/, namespace: 'test-ui' }, args => ({ contents: args.path === 'runtime' ? 'export const useOptionalSessionRuntime = () => globalThis.companionRuntime' : 'export const saveSessionCompanionVisibility = async () => {}' }))
  b.onResolve({ filter: /^(?:react(?:-dom)?(?:\/.*)?|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
} }
const { CompanionsView } = await bundle('../../../apps/web/src/views/CompanionsView.tsx', [uiMocks])
for (const role of ['MASTER', 'PLAYER']) test(`gallery offers management only to MASTER (${role})`, () => {
  globalThis.companionRuntime = { role, status: 'connected', runtimeConfigSnapshot: { config: { creatureCompendium: [creature], companionPortraits: [{ id: 'nessa', name: 'Nessa', imageUrl: 'https://example.com/nessa.png' }] } } }
  const markup = renderToStaticMarkup(createElement(CompanionsView))
  assert.equal(markup.includes('Adicionar acompanhante'), role === 'MASTER')
  assert.equal(markup.includes('Remover Nessa dos acompanhantes'), role === 'MASTER')
  assert.equal(markup.includes('SECRET SHEET'), false)
  assert.match(markup, /Nessa/)
})
test('disconnected master cannot add a companion', () => {
  globalThis.companionRuntime = { role: 'MASTER', status: 'disconnected', runtimeConfigSnapshot: { config: { creatureCompendium: [], companionPortraits: [] } } }
  const markup = renderToStaticMarkup(createElement(CompanionsView))
  assert.match(markup, /disabled=""/)
  assert.match(markup, /Conecte-se/)
  assert.equal(markup.includes('ao editar uma criatura'), false)
})
