import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const built = await build({ stdin: { contents: `export { SessionActor } from './apps/session-server/src/routes/session/SessionActor'; export { createCompendiumCreature } from './apps/web/src/models/creatures/CompendiumCreature'; export { synchronizeCompanionInitiative } from './apps/session-server/src/routes/initiative/companionInitiativeSync'; export { createInitiativeEntry } from './apps/web/src/models/initiative/Initiative'; export { visibleRuntimeConfigSnapshot } from './apps/session-server/src/routes/session/runtimeConfigAccess';`, loader: 'ts', resolveDir: fileURLToPath(new URL('../../../', import.meta.url)) }, bundle: true, platform: 'node', format: 'esm', write: false, conditions: ['types'], plugins: [{ name: 'workers', setup(b) {
  b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'workers', namespace: 'test-workers' }))
  b.onLoad({ filter: /.*/, namespace: 'test-workers' }, () => ({ contents: 'export class DurableObject { constructor(ctx) { this.ctx = ctx } }' }))
} }] })
const { SessionActor, createCompendiumCreature, synchronizeCompanionInitiative, createInitiativeEntry, visibleRuntimeConfigSnapshot } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'))
function setup(extra = {}) {
  const npc = createCompendiumCreature({ id: 'npc', name: 'Rosa', maxHp: 20, showInCompanions: true, ...extra })
  npc.actions = [{ id: 'feature', name: 'Comando', usage: { max: 2, reset: 'longRest' } }]
  npc.spellcasting = { slots: { 1: 2 }, spells: [] }
  const snapshot = { creationRevision: 1, config: { characters: [], spells: [], customSystems: [], creatureCompendium: [npc] } }
  const data = new Map([['runtime-config-state', snapshot]])
  const sockets = ['MASTER', 'PLAYER'].map(role => ({ messages: [], deserializeAttachment: () => ({ role, userId: role === 'MASTER' ? 'dm' : 'owner', visibleCharacterIds: [], lastHeartbeatAt: Date.now() }), send(raw) { this.messages.push(JSON.parse(raw)) } }))
  const ctx = { storage: { get: async key => structuredClone(data.get(key)), put: async (key, value) => { if (typeof key === 'string') data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) data.set(k, structuredClone(v)) } }, getWebSockets: () => sockets }
  return { npc, snapshot, data, sockets, actor: new SessionActor(ctx) }
}
test('master maintains unassigned NPC HP, feature uses and spell slots outside initiative', async () => {
  const { actor, sockets, data } = setup()
  for (const operation of [{ type: 'hp', mode: 'damage', amount: 7, damageType: 'bludgeoning' }, { type: 'feature', featureId: 'feature', delta: -1 }, { type: 'spellSlot', level: 1, delta: -1 }]) {
    await actor.handleCompanionOperation(sockets[0], sockets[0].deserializeAttachment(), { creatureId: 'npc', ...operation })
  }
  const saved = data.get('companions-state').npc
  assert.equal(saved.currentHp, 13)
  assert.equal(saved.featureUses.feature, 1)
  assert.equal(saved.spellSlots[1], 1)
  assert.equal(sockets[1].messages.length, 0)
  await actor.sendCompanionsSnapshot(sockets[0])
  assert.equal(sockets[0].messages.at(-1).companions[0].currentHp, 13)
})
test('public NPC sheets and persistent state remain master-only even with an owner ID', async () => {
  const { actor, sockets, data, snapshot } = setup({ ownerUserId: 'owner' })
  await actor.handleCompanionOperation(sockets[1], sockets[1].deserializeAttachment(), { type: 'hp', creatureId: 'npc', mode: 'set', amount: 1 })
  assert.equal(sockets[1].messages.at(-1).code, 'COMPANION_ACCESS_DENIED')
  assert.equal(data.has('companions-state'), false)
  await actor.sendCompanionsSnapshot(sockets[1])
  assert.deepEqual(sockets[1].messages.at(-1).companions, [])
  const projection = visibleRuntimeConfigSnapshot(sockets[1].deserializeAttachment(), snapshot)
  assert.deepEqual(projection.config.creatureCompendium, [])
  assert.equal(projection.config.companionPortraits[0].name, 'Rosa')
})
test('assigned familiars still allow their owner to update state', async () => {
  const { actor, sockets, data } = setup({ ownerUserId: 'owner', showInCompanions: false, controlKind: 'familiar' })
  await actor.handleCompanionOperation(sockets[1], sockets[1].deserializeAttachment(), { type: 'hp', creatureId: 'npc', mode: 'damage', amount: 2, damageType: 'bludgeoning' })
  assert.equal(data.get('companions-state').npc.currentHp, 18)
  assert.equal(sockets[1].messages.at(-1).type, 'session.companions.updated')
})
test('unassigned NPC state survives entering and leaving initiative', () => {
  const { snapshot } = setup()
  const saved = { npc: { creatureId: 'npc', currentHp: 13, maxHp: 20, temporaryHp: 3, featureUses: { feature: 1 }, spellSlots: { 1: 1 }, spellPerDay: {}, revision: 1 } }
  const entry = createInitiativeEntry({ id: 'turn', sourceId: 'compendium:npc', sourceType: 'monster', name: 'Rosa', currentHp: 20, maxHp: 20, side: 'ally', initiative: 10, initiativeBonus: 0 })
  const before = { entries: [] }
  const added = synchronizeCompanionInitiative(before, { entries: [entry] }, snapshot, saved)
  assert.equal(added.session.entries[0].currentHp, 13)
  assert.equal(added.session.entries[0].temporaryHp, 3)
  const changed = synchronizeCompanionInitiative(added.session, { entries: [{ ...added.session.entries[0], currentHp: 9 }] }, snapshot, added.companions)
  assert.equal(changed.companions.npc.currentHp, 9)
  const removed = synchronizeCompanionInitiative(changed.session, { entries: [] }, snapshot, changed.companions)
  assert.equal(removed.companions.npc.currentHp, 9)
})

test('master can roll monster damage while only the master receives the description', async () => {
  const { actor, npc, sockets } = setup()
  npc.actions = [{
    id: 'feature', name: 'Comando', description: 'Segredo do mestre',
    mechanics: { kind: 'damage', damage: [{ formula: '1d6', damageType: 'fire' }] },
  }]
  const [master, player] = sockets
  const request = {
    requestId: 'private-description', creatureId: npc.id, mode: 'normal',
    source: { type: 'feature', featureId: 'feature', intent: 'resolve' },
  }
  await actor.handleCreatureRoll(master, master.deserializeAttachment(), { ...request, hideDescription: true })
  const privateResult = master.messages.at(-1).result
  const publicResult = player.messages.at(-1).result
  assert.equal(privateResult.description, 'Segredo do mestre')
  assert.equal(publicResult.description, undefined)
  assert.equal(publicResult.title, 'Comando')
  assert.equal(publicResult.damages.length, 1)
  assert.deepEqual(publicResult.damages, privateResult.damages)

  await actor.handleCreatureRoll(master, master.deserializeAttachment(), {
    ...request, hideDescription: true, source: { ...request.source, intent: 'announce' },
  })
  const revealed = player.messages.at(-1).result
  assert.equal(revealed.description, 'Segredo do mestre')
  assert.equal(revealed.damages, undefined)
})
