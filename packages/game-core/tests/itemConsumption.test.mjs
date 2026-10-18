import test from "node:test"
import assert from "node:assert/strict"
import { consumeItemQuantity, consumeInventoryItem } from "../src/itemConsumption.ts"

test("consuming stacks reduces quantities without mutating input", () => {
 const item={id:"a",kind:"ammunition",quantity:5}
 assert.deepEqual(consumeItemQuantity(item,2),{...item,quantity:3})
 assert.equal(item.quantity,5)
 assert.equal(consumeItemQuantity(item,5),null)
})
test("nonconsumables are left alone",()=>{
 const item={id:"a",kind:"weapon",quantity:1}
 assert.equal(consumeItemQuantity(item),item)
})
test("inventory consumption removes depleted entries",()=>{
 const items=[{id:"a",kind:"consumable",quantity:1},{id:"b",kind:"tool",quantity:3}]
 assert.deepEqual(consumeInventoryItem(items,"a"),[items[1]])
 assert.equal(consumeInventoryItem(items,"missing"),items)
})
