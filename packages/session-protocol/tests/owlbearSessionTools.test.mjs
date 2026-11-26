import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
const built = await build({
  entryPoints: [fileURLToPath(new URL('../../../apps/owlbear-extension/src/NativeSessionToolsHost.tsx', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', write: false, jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' },
  plugins: [{ name: 'external-dependencies', setup(b) {
    b.onResolve({ filter: /^(?:react(?:-dom)?(?:\/.*)?|react-router-dom|lucide-react|axios|jszip)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }))
  } }],
})
const { NativeSessionToolsHost } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
function render(area, role = 'PLAYER', accessible = true) {
  const runtime = {
    status: 'connected', sessionId: 'campaign', role,
    sessionCharactersById: {}, abilitiesByCharacterId: {}, hpByCharacterId: {}, conditionsByCharacterId: {}, companionsById: {},
    inventoryState: { initialized: true, partyInventoryAccessible: accessible, partyInventory: [], groundInventory: [], partyDepots: [] },
    runtimeConfigSnapshot: { config: { creatureCompendium: [], companionPortraits: [{id:'npc',name:'Nessa',imageUrl:'https://example.com/nessa.png'}] } },
  }
  return renderToStaticMarkup(createElement(NativeSessionToolsHost, { area, runtime, userId: 'user', spells: [] }))
}
test('Owlbear group inventory respects unavailable depots for players', () => {
  assert.match(render('party', 'PLAYER', false), /Inventário do grupo inacessível/)
  assert.doesNotMatch(render('party', 'MASTER', false), /Inventário do grupo inacessível/)
})
test('Owlbear ground screen exposes transfers and restricts item creation to master', () => {
  assert.match(render('ground'), /Itens no chão/)
  assert.doesNotMatch(render('ground'), /Adicionar item<\/button>/)
  assert.match(render('ground', 'MASTER'), /Adicionar item/)
})
test('Owlbear companions show portraits and reserve sheet access for master', () => {
  assert.match(render('companions'), /Nessa/)
  assert.doesNotMatch(render('companions'), /Abrir ficha de Nessa/)
  assert.match(render('companions', 'MASTER'), /Abrir ficha de Nessa/)
})
