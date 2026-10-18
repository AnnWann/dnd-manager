import test from "node:test"
import assert from "node:assert/strict"
import { mergeItemIntoInventory } from "../src/inventoryStacks.ts"

test("matching item stacks merge quantities", () => {
 const current=[{id:"old",kind:"ammunition",name:"Arrows",quantity:3,weight:0.02}]
 const result=mergeItemIntoInventory(current,{id:"new",kind:"ammunition",name:"Arrows",quantity:4,weight:0.02})
 assert.equal(result.length,1)
 assert.equal(result[0].quantity,7)
 assert.equal(current[0].quantity,3)
})
test("different item fields retain separate stacks",()=>{
 const current=[{id:"a",kind:"scroll",name:"Scroll",quantity:1,rarity:"uncommon"}]
 const result=mergeItemIntoInventory(current,{id:"b",kind:"scroll",name:"Scroll",quantity:1,rarity:"rare"})
 assert.equal(result.length,2)
})
