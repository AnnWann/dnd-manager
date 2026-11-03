import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"

const compiled = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL("../../../", import.meta.url)),
    contents: [
      'export { sendVisibilityFiltered } from "./apps/session-server/src/routes/session/visibilityDelivery"',
      'export { applyInitiativeOperation } from "./apps/session-server/src/routes/initiative/InitiativeSessionActor"',
      'export { createInitiativeSession } from "./apps/web/src/models/initiative/Initiative"',
      'export { createCreatureInitiativeEntries } from "./apps/web/src/models/initiative/creatureInitiativeEntries"',
      'export { createCompendiumCreature } from "./apps/web/src/models/creatures/CompendiumCreature"',
    ].join("\n"),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  conditions: ["types"],
  write: false,
})
const {
  sendVisibilityFiltered, applyInitiativeOperation, createInitiativeSession,
  createCreatureInitiativeEntries, createCompendiumCreature,
} = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].contents).toString("base64"))

function deliver(session, role, type) {
  let delivered
  sendVisibilityFiltered({
    deserializeAttachment: () => ({ role, userId: role, canReadAnyCharacter: true }),
    send: (value) => { delivered = JSON.parse(value) },
  }, { type, state: { initialized: true, session } })
  return delivered.state.session
}

test("hidden first rolls, turn IDs and multiple turns stay private until the creature is revealed", () => {
  const creature = createCompendiumCreature({ name: "Emboscador", unique: true, initiativeTurns: 2 })
  const hidden = createCreatureInitiativeEntries(creature, [], { hidden: true, roll: () => 19 })
  const added = applyInitiativeOperation(createInitiativeSession(), {
    type: "initiative.entries.add", characterId: "session",
    entries: [...hidden, { name: "Visível", sourceType: "monster", initiative: 10, initiativeBonus: 0, side: "enemy" }],
  }, null, {}, {})
  assert.equal(added.ok, true)
  const [first, second, visible] = added.session.entries
  const combat = { ...added.session, started: true, activeEntryId: first.id, roundAnchorEntryId: first.id }
  for (const type of ["session.initiative.snapshot", "session.initiative.updated"]) {
    const player = deliver(combat, "PLAYER", type)
    assert.deepEqual(player.entries.map(entry => entry.id), [visible.id])
    assert.equal(player.entries[0].order, 0)
    assert.equal(player.activeEntryId, undefined)
    assert.equal(player.roundAnchorEntryId, undefined)
    assert.equal(player.started, true)
    assert.equal(deliver(combat, "MASTER", type).entries[0].initiative, 19)
  }
  const update = (session, hidden) => applyInitiativeOperation(session, {
    type: "initiative.entry.update", characterId: "session", entryId: first.id, patch: { hidden },
  }, null, {}, {}).session
  const revealed = deliver(update(combat, false), "PLAYER", "session.initiative.updated")
  assert.deepEqual(revealed.entries.map(entry => entry.id), [first.id, second.id, visible.id])
  assert.equal(revealed.activeEntryId, first.id)
  const hiddenAgain = deliver(update(update(combat, false), true), "PLAYER", "session.initiative.updated")
  assert.deepEqual(hiddenAgain.entries.map(entry => entry.id), [visible.id])
})
