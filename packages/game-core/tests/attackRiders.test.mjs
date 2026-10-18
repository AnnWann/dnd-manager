import test from "node:test"
import assert from "node:assert/strict"
import { parseAttackRiderDice, getAttackRiderDamageChoices, resolveAttackRiderDamageChoice, getWeaponRiderTransformation } from "../src/attackRiders.ts"

test("attack rider dice parser is bounded",()=>{
 assert.deepEqual(parseAttackRiderDice("2d6+3"),{quantity:2,sides:6,flat:3})
 assert.equal(parseAttackRiderDice("21d6"),undefined)
 assert.equal(parseAttackRiderDice("2d100"),undefined)
})
test("damage choices intersect and reject illegal selections",()=>{
 const riders=[{id:"1",label:"1",scope:"weapon",damageTypeChoices:["fire","cold"],damage:{dice:"1d6"}},{id:"2",label:"2",scope:"weapon",damageTypeChoices:["fire","lightning"]}]
 assert.deepEqual(getAttackRiderDamageChoices(riders),["fire"])
 assert.throws(()=>resolveAttackRiderDamageChoice(riders,"cold"))
 const result=resolveAttackRiderDamageChoice(riders,"fire")
 assert.equal(result[0].damage.damageType,"fire")
})
test("weapon transformation uses final applicable rider",()=>{
 const riders=[{id:"a",label:"a",scope:"weapon",replaceWeaponDamageType:"cold"},{id:"b",label:"b",scope:"weapon",replaceWeaponDamageType:"fire",addThrown:true}]
 const result=getWeaponRiderTransformation(riders)
 assert.equal(result.damageType,"fire")
 assert.equal(result.thrown,true)
})
