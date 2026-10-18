import test from "node:test"
import assert from "node:assert/strict"
import { calculateEncumbrance, getStrengthWeightLimitKg } from "../src/encumbrance.ts"
import { canItemGoInPocket, getDefaultPocketableForKind } from "../src/pocketability.ts"
import { parseManualDiceExpression } from "../src/manualDiceExpression.ts"

test("encumbrance capacity scales with strength and size", () => {
  const normal=calculateEncumbrance(0,10,"medium")
  assert.ok(Math.abs(normal.carryingCapacity-150*0.45359237)<0.00001)
  assert.equal(getStrengthWeightLimitKg(10,"large",15),normal.carryingCapacity*2)
  assert.equal(calculateEncumbrance(normal.encumbranceLimit+0.01,10,"medium").state,"encumbered")
  assert.equal(calculateEncumbrance(normal.heavyEncumbranceLimit+0.01,10,"medium").state,"heavily-encumbered")
  assert.equal(calculateEncumbrance(normal.carryingCapacity+0.01,10,"medium").state,"over-capacity")
})
test("pocketability follows item kinds and explicit overrides", () => {
  assert.equal(canItemGoInPocket({kind:"scroll"}),true)
  assert.equal(canItemGoInPocket({kind:"shield",pocketable:true}),false)
  assert.equal(canItemGoInPocket({kind:"common",pocketable:true}),true)
  assert.equal(getDefaultPocketableForKind("currency"),false)
})
test("manual dice grammar keeps validation limits", () => {
  const valid=parseManualDiceExpression("2d6+3")
  assert.equal(valid.ok,true)
  const invalid=parseManualDiceExpression("1000d6")
  assert.equal(invalid.ok,false)
})
