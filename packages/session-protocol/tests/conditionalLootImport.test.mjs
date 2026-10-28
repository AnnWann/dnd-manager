import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const built = await build({
  entryPoints: ['apps/web/src/features/creatures/creatureCompendiumIO.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'node-jszip', setup(b) {
    b.onResolve({ filter: /^jszip$/ }, () => ({ path: pathToFileURL(require.resolve('jszip')).href, external: true }))
  } }],
})
const { importCreatureFiles, getCreatureJsonTemplate } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
const item = { name: 'Escama', quantity: 2, dropQuantityFormula: '2d8+1', weight: 0.2, kind: 'common' }
for (const [label, conditional] of [
  ['native', [{ id: 'drop', item, dmHint: 'Intacta' }]],
  ['flat', [{ ...item, condition: 'Intacta' }]],
  ['grouped', [{ items: [item], condition: 'Intacta' }]],
]) {
  for (const format of ['json', 'zip', 'manifest-zip']) {
    test(`${format} preserves ${label} conditional drops and dice quantities`, async () => {
      const creature = { name: 'Serpente', drops: { conditional } }
      let file = new File([JSON.stringify(creature)], 'creature.json')
      if (format !== 'json') {
        const zip = new JSZip()
        zip.file('creature.json', JSON.stringify(creature))
        if (format === 'manifest-zip') zip.file('manifest.json', JSON.stringify({ format: 'dnd-manager-creature-pack', version: 1, entries: [{ name: 'Serpente', jsonPath: 'creature.json' }] }))
        file = await zip.generateAsync({ type: 'nodebuffer' })
        file.name = 'creatures.zip'
      }
      const result = await importCreatureFiles([file])
      assert.deepEqual(result.warnings, [])
      const drops = result.creatures[0].drops.conditional
      assert.equal(drops.length, 1)
      assert.equal(drops[0].item.name, 'Escama')
      assert.equal(drops[0].item.quantity, 2)
      assert.equal(drops[0].item.dropQuantityFormula.replaceAll(' ', ''), '2d8+1')
      assert.equal(drops[0].dmHint, 'Intacta')
    })
  }
}
test('JSON template documents native conditional drops', () => {
  assert.equal(JSON.parse(getCreatureJsonTemplate()).drops.conditional.length, 1)
})
