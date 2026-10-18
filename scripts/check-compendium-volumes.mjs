import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const catalog = readFileSync("apps/web/src/features/items/itemCompendium.ts", "utf8")
const volumesFile = readFileSync("packages/game-core/src/standardItemVolumes.ts", "utf8")
const catalogIds = [...catalog.matchAll(/(?:weapon|armor|item)\("([^"]+)"/g)].map(match => match[1])
const table = volumesFile.split("export const STANDARD_ITEM_VOLUME_LITERS")[1]
  ?.split("/** 2014 D&D 5e container capacities")[0]
assert.ok(table, "Missing the standard volume table")
const entries = [...table.matchAll(/^  "([^"]+)": (\d+(?:\.\d+)?),$/gm)]
const volumes = new Map(entries.map(match => [match[1], Number(match[2])]))
assert.equal(volumes.size, entries.length, "Duplicate volume IDs found")
assert.equal(new Set(catalogIds).size, catalogIds.length, "Duplicate catalog IDs found")
for (const id of catalogIds) {
  assert.ok(volumes.has(id), `Missing liters for compendium-${id}`)
}
assert.ok(volumes.has("bag-of-holding"), "Missing Bag of Holding exterior liters")
assert.deepEqual(
  [...volumes.keys()].filter(id => id !== "bag-of-holding" && !catalogIds.includes(id)),
  [], "Volume entries must correspond to standard items",
)
for (const [id, volume] of volumes) {
  assert.ok(Number.isFinite(volume) && volume > 0, `Invalid liters for ${id}`)
}
assert.ok(volumes.get("plate-armor") > volumes.get("dagger"), "Large armor must be bulkier than a dagger")
assert.ok(volumes.get("barrel") > volumes.get("backpack"), "A barrel must be bulkier than an empty backpack")
assert.ok(volumes.get("torch") < volumes.get("tent"), "A torch must be smaller than a tent")
console.log(`Validated ${catalogIds.length} standard equipment volumes + Bag of Holding exterior volume.`)
