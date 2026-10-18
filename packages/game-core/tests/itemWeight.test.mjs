import test from "node:test"
import assert from "node:assert/strict"
import {calculateItemStackWeightKg} from "../src/itemWeight.ts"

test("item stack weight uses quantity for ordinary equipment",()=>{
 assert.equal(calculateItemStackWeightKg(1.5,3),4.5)
 assert.equal(calculateItemStackWeightKg(-10,4),0)
})
test("supply portions override package quantity",()=>{
 assert.equal(calculateItemStackWeightKg(0.45,2,1.5),0.675)
 assert.equal(calculateItemStackWeightKg(0.45,2,0),0)
})
