import test from "node:test"
import assert from "node:assert/strict"
import { parseAttackRiderDice, getAttackRiderDamageChoices, resolveAttackRiderDamageChoice, getWeaponRiderTransformation, getUnarmedRiderDamageDice } from "../src/attackRiders.ts"

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

test("unarmed rider replaces base dice without accidentally treating damage as extra", () => {
  const riders = [
    { id: "a", label: "Estilo", scope: "unarmed", unarmedDamageDice: "1d6" },
    { id: "b", label: "Infusão", scope: "unarmed", unarmedDamageDice: "2d8" },
  ]
  assert.deepEqual(getUnarmedRiderDamageDice(riders), { quantity: 2, sides: 8 })
  assert.deepEqual(getUnarmedRiderDamageDice(riders.slice(0, 1)), { quantity: 1, sides: 6 })
  assert.equal(getUnarmedRiderDamageDice([]), undefined)
})

test("invalid, flat and unrelated weapon damage overrides cannot change unarmed base dice", () => {
  const cases = ["2d6+1", "21d6", "1d100", "1d6-3", "", "not dice"]
  for (const dice of cases) {
    assert.equal(getUnarmedRiderDamageDice([
      { id: "x", label: "Invalido", scope: "unarmed", unarmedDamageDice: dice },
    ]), undefined, dice)
  }
  assert.equal(getUnarmedRiderDamageDice([
    { id: "w", label: "Espada", scope: "weapon", unarmedDamageDice: "1d20" },
  ]), undefined)
  assert.deepEqual(getUnarmedRiderDamageDice([
    { id: "a", label: "Valido", scope: "unarmed", unarmedDamageDice: "1d10" },
    { id: "b", label: "Invalido", scope: "all", unarmedDamageDice: "0d4" },
  ]), { quantity: 1, sides: 10 })
})
