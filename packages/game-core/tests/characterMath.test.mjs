import test from "node:test"
import assert from "node:assert/strict"
import { proficiencyBonus, abilityModifier } from "../src/characterMath.ts"

test("proficiency progression includes level one and level twenty",()=>{
 assert.equal(proficiencyBonus(1),2)
 assert.equal(proficiencyBonus(5),3)
 assert.equal(proficiencyBonus(9),4)
 assert.equal(proficiencyBonus(13),5)
 assert.equal(proficiencyBonus(17),6)
})
test("ability modifiers round down for odd scores",()=>{
 assert.equal(abilityModifier(8),-1)
 assert.equal(abilityModifier(9),-1)
 assert.equal(abilityModifier(10),0)
 assert.equal(abilityModifier(17),3)
})
