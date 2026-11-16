import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
const built = await build({
  stdin: { contents: `export { SessionActor } from "./apps/session-server/src/routes/characters/inventory/InventorySessionActor"; export { planPartyDailySupplies } from "./apps/web/src/models/supplies/partyDailySupplies"; export { parseInventoryClientMessage } from "./apps/session-server/src/routes/characters/inventory/inventoryProtocol";`, loader: "ts", resolveDir: fileURLToPath(new URL("../../../", import.meta.url)) },
  bundle: true, platform: "node", format: "esm", write: false, plugins: [{
    name: "workers", setup(b) {
      b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "workers", namespace: "workers" }))
      b.onLoad({ filter: /.*/, namespace: "workers" }, () => ({ contents: "export class DurableObject { constructor(ctx) { this.ctx = ctx } }" }))
    },
  }],
})
const { SessionActor, planPartyDailySupplies, parseInventoryClientMessage } = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].contents).toString("base64"))
const settings = {
  enabled: true, useRaceMultipliers: true, shortageMode: "partial",
  food: { enabled: true, portionsPerStandardRest: 1, amountPerPortion: 0.45, unit: "kg", label: "Comida" },
  drink: { enabled: true, portionsPerStandardRest: 1, amountPerPortion: 4, unit: "L", label: "Água" },
}
const supply = (category, units) => ({ id: category, name: category, kind: "supply", supplyCategory: category, supplyUnitsPerItem: units, quantity: 1 })
test("daily consumption covers every consumer plus extras, with fractional portions and separate food/water", () => {
  const items = [supply("food", 10), supply("drink", 10), { id: "sword", name: "Espada", kind: "weapon" }]
  const plan = planPartyDailySupplies(items, { count: 2, food: 1.5, drink: 2 }, 1, settings)
  assert.equal(plan.error, null)
  assert.equal(plan.consumption.selectedFoodPortions, 2.5)
  assert.equal(plan.consumption.selectedDrinkPortions, 3)
  assert.equal(plan.consumption.items[0].remainingSupplyUnits, 7.5)
  assert.equal(plan.consumption.items[1].remainingSupplyUnits, 7)
  assert.deepEqual(plan.consumption.items[2], items[2])
  assert.equal(items[0].remainingSupplyUnits, undefined)
})
test("disabled race multipliers, disabled water, shortages and disabled consumption respect campaign settings", () => {
  const items = [supply("food", 10)]
  const plan = planPartyDailySupplies(items, { count: 2, food: 0, drink: 0 }, 1, { ...settings, useRaceMultipliers: false, drink: { ...settings.drink, enabled: false } })
  assert.equal(plan.consumption.selectedFoodPortions, 3)
  assert.equal(plan.error, null)
  const partial = planPartyDailySupplies([supply("food", 1)], { count: 2, food: 2, drink: 2 }, 0, settings)
  assert.equal(partial.enough, false)
  assert.equal(partial.error, null)
  assert.deepEqual(partial.consumption.items, [])
  assert.ok(planPartyDailySupplies([supply("food", 1)], { count: 2, food: 2, drink: 2 }, 0, { ...settings, shortageMode: "block" }).error)
  assert.ok(planPartyDailySupplies(items, { count: 2, food: 2, drink: 2 }, 0, { ...settings, enabled: false }).error)
})
function setup() {
  const inventory = { initialized: true, revision: 1, partyInventory: [supply("food", 10), supply("drink", 10)], groundInventory: [], additionalSupplyConsumption: 1 }
  const data = new Map([
    ["inventory-state", inventory],
    ["runtime-config-state", { creationRevision: 1, config: { longRestSupplies: settings } }],
    ["abilities-state", { a: { initialized: true, characterId: "a", character: { id: "a", name: "A" } }, b: { initialized: true, characterId: "b", character: { id: "b", name: "B" } } }],
    ["characters-state", { a: { active: true }, b: { active: false } }],
  ])
  const sockets = ["MASTER", "PLAYER"].map(role => ({
    messages: [], deserializeAttachment: () => ({ role, userId: role, lastHeartbeatAt: Date.now() }),
    send(raw) { this.messages.push(JSON.parse(raw)) },
  }))
  const storage = {
    get: async key => structuredClone(data.get(key)),
    put: async (key, value) => { if (typeof key === "string") data.set(key, structuredClone(value)); else for (const [k,v] of Object.entries(key)) data.set(k, structuredClone(v)) },
  }
  storage.transaction = async fn => fn(storage)
  return { data, sockets, actor: new SessionActor({ storage, getWebSockets: () => sockets }) }
}
const operation = { type: "party.supplies.day.consume", characterId: "session", expectedRevision: 1 }
test("server restricts consumption to masters, ignores inactive characters, rejects stale duplicates and records undo", async () => {
  const { data, sockets, actor } = setup()
  await actor.handleInventoryOperation(sockets[1], sockets[1].deserializeAttachment(), operation)
  assert.equal(data.get("inventory-state").revision, 1)
  assert.equal(sockets[1].messages.at(-1).code, "CHARACTER_ACCESS_DENIED")
  await actor.handleInventoryOperation(sockets[0], sockets[0].deserializeAttachment(), operation)
  const consumed = data.get("inventory-state")
  assert.equal(consumed.revision, 2)
  assert.equal(consumed.partyInventory[0].remainingSupplyUnits, 8)
  assert.equal(consumed.partyInventory[1].remainingSupplyUnits, 8)
  assert.deepEqual(data.get("hp-state"), {})
  const log = [...data.values()].find(value => Array.isArray(value) && value.some(record => record.operation?.type === operation.type))
  assert.ok(log)
  assert.equal(log.at(-1).reverseOperation.snapshot.inventory.partyInventory[0].quantity, 1)
  assert.equal(log.at(-1).reverseOperation.snapshot.inventory.partyInventory[0].remainingSupplyUnits, undefined)
  await actor.handleInventoryOperation(sockets[0], sockets[0].deserializeAttachment(), operation)
  assert.equal(sockets[0].messages.at(-1).code, "SUPPLIES_STALE")
  assert.deepEqual(data.get("inventory-state"), consumed)
})
test("wire validation rejects missing revision and invalid scope", () => {
  const parse = op => parseInventoryClientMessage(JSON.stringify({ type: "session.inventory.operation", operation: op }))
  assert.ok(parse(operation))
  assert.equal(parse({ ...operation, expectedRevision: -1 }), null)
  assert.equal(parse({ ...operation, expectedRevision: undefined }), null)
  assert.equal(parse({ ...operation, characterId: "a" }), null)
})


test("blocking shortage rule leaves the shared stock unchanged on the server", async () => {
  const { data, sockets, actor } = setup()
  data.get("runtime-config-state").config.longRestSupplies = { ...settings, shortageMode: "block" }
  data.get("inventory-state").partyInventory = [supply("food", 1)]
  const before = structuredClone(data.get("inventory-state"))
  await actor.handleInventoryOperation(sockets[0], sockets[0].deserializeAttachment(), operation)
  assert.equal(sockets[0].messages.at(-1).code, "SUPPLIES_CONSUMPTION_REJECTED")
  assert.deepEqual(data.get("inventory-state"), before)
})
