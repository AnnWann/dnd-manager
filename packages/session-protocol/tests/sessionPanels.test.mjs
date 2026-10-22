import { test } from "node:test"
import assert from "node:assert/strict"
import {
  applySessionPanelOperation,
  EMPTY_SESSION_PANELS,
  parseSessionPanelOperation,
  parseSessionPanelsServerMessage,
  projectSessionPanels,
} from "../src/sessionPanels.ts"

const clock = (id, visibility) => ({
  id, title: id, kind: "clock", visibility,
  clock: { value: 0, max: 6, label: "Perigo" },
})
const html = (id, visibility) => ({
  id, title: id, kind: "html", visibility,
  html: "<h1>SEGREDO DO MESTRE</h1>",
  playerHtml: "<h1>Mapa revelado</h1>",
  storage: { "map": "COORDENADAS SECRETAS" },
})

test("player never receives private panels or master HTML and storage", () => {
  const source = { revision: 7, panels: [
    html("secret", "private"), html("map", "shared"), clock("threat", "collaborative"),
  ] }
  const publicState = projectSessionPanels(source, false)
  assert.equal(publicState.panels.length, 2)
  assert.equal(publicState.panels[0].id, "map")
  assert.equal(publicState.panels[0].html, "<h1>Mapa revelado</h1>")
  assert.equal(publicState.panels[0].playerHtml, undefined)
  assert.equal(publicState.panels[0].storage, undefined)
  assert.ok(!JSON.stringify(publicState).includes("SEGREDO"))
  assert.ok(!JSON.stringify(publicState).includes("COORDENADAS"))
  assert.equal(projectSessionPanels(source, true).panels.length, 3)
})

test("only the master can create, change or delete panels", () => {
  const operation = { type: "upsert", panel: clock("clock1", "shared") }
  assert.equal(applySessionPanelOperation(EMPTY_SESSION_PANELS, operation, false), null)
  const initial = applySessionPanelOperation(EMPTY_SESSION_PANELS, operation, true)
  assert.equal(initial.revision, 1)
  assert.equal(initial.panels[0].clock.value, 0)
  assert.equal(applySessionPanelOperation(initial, {type:"delete",id:"clock1"},false), null)
  assert.equal(applySessionPanelOperation(initial, {type:"delete",id:"clock1"},true).panels.length, 0)
})

test("players can only advance collaborative clocks", () => {
  let state = EMPTY_SESSION_PANELS
  for (const panel of [clock("priv", "private"), clock("shared", "shared"), clock("collab", "collaborative")]) {
    state = applySessionPanelOperation(state, {type:"upsert", panel}, true)
  }
  const op = id => ({ type: "clock.advance", id, delta: 1 })
  assert.equal(applySessionPanelOperation(state, op("priv"), false), null)
  assert.equal(applySessionPanelOperation(state, op("shared"), false), null)
  state = applySessionPanelOperation(state, op("collab"), false)
  assert.equal(state.panels.find(p => p.id === "collab").clock.value, 1)
  state = applySessionPanelOperation(state, {type:"clock.advance",id:"collab",delta:100},true)
  assert.equal(state.panels.find(p => p.id === "collab").clock.value, 6)
})

test("storage only writable by master and never carried on player projection", () => {
  let state = applySessionPanelOperation(EMPTY_SESSION_PANELS, {type:"upsert",panel:html("map","collaborative")},true)
  const op = {type:"storage.replace",id:"map",storage:{key:"private"}}
  assert.equal(applySessionPanelOperation(state, op, false), null)
  state = applySessionPanelOperation(state, op, true)
  assert.equal(state.panels[0].storage.key, "private")
  assert.equal(projectSessionPanels(state, false).panels[0].storage, undefined)
})

test("invalid and oversized HTML or operations are not accepted", () => {
  const valid = {type:"session.panels.operation",operation:{type:"upsert",panel:html("map","shared")}}
  assert.deepEqual(parseSessionPanelOperation(JSON.stringify(valid)).type, "upsert")
  valid.operation.panel.html = "X".repeat(75001)
  assert.equal(parseSessionPanelOperation(JSON.stringify(valid)),null)
  assert.equal(parseSessionPanelOperation(JSON.stringify({
    type:"session.panels.operation",operation:{type:"clock.advance",id:"clock",delta:1.5}
  })),null)
  const malformed = '{"type":"session.panels.operation"}'
  assert.equal(parseSessionPanelOperation(malformed), null)
})

test("server panel snapshots are accepted by the client parser", () => {
  const state = { revision: 2, panels: [clock("shared", "shared")] }
  const parsed = parseSessionPanelsServerMessage(JSON.stringify({type:"session.panels.snapshot",state}))
  assert.deepEqual(parsed.state,state)
  assert.equal(parseSessionPanelsServerMessage('{"type":"session.panels.snapshot","state":{"revision":-1,"panels":[]}}'),null)
})
