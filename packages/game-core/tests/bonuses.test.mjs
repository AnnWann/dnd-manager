import test from "node:test"
import assert from "node:assert/strict"
import { applyBonus, applyBonuses } from "../src/numericBonuses.ts"
import { sumAsiAttributeIncreases } from "../src/asi.ts"

test("flat bonuses override additive and subtractive modifiers",()=>{
 assert.equal(applyBonus(10,{type:"add",value:3}),13)
 assert.equal(applyBonus(10,{type:"sub",value:3}),7)
 assert.equal(applyBonuses(10,[{type:"add",value:4},{type:"flat",value:15}]),15)
})
test("ASI increments ignore negative values",()=>{
 const entries=[{increases:{str:2,dex:-1}},{increases:{str:1}}]
 assert.equal(sumAsiAttributeIncreases(entries,"str"),3)
 assert.equal(sumAsiAttributeIncreases(entries,"dex"),0)
})
