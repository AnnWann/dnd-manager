import test from "node:test"
import assert from "node:assert/strict"
import { getWeaponHandsUsed, getWeaponAttackAttribute, getWeaponDamageDie, isWeaponImprovisedGrip } from "../src/weaponRules.ts"
const weapon={properties:[{id:"two-handed"}],modifierAttribute:"dex",damage:{quantity:2,sides:"d6"}}
test("two-handed weapons without two-hand grip use improvised rules",()=>{
 assert.equal(getWeaponHandsUsed(weapon),2)
 const oneHand={...weapon,wieldedTwoHanded:false}
 assert.equal(isWeaponImprovisedGrip(oneHand),true)
 assert.equal(getWeaponHandsUsed(oneHand),1)
 assert.equal(getWeaponAttackAttribute(oneHand),"str")
 assert.deepEqual(getWeaponDamageDie(oneHand),{quantity:1,sides:"d4"})
})
test("versatile weapons use alternate dice in two hands",()=>{
 const versatile={properties:[{id:"versatile"}],damage:{quantity:1,sides:"d8"},versatileDamage:{quantity:1,sides:"d10"},wieldedTwoHanded:true}
 assert.deepEqual(getWeaponDamageDie(versatile),{quantity:1,sides:"d10"})
})
