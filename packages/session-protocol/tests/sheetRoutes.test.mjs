import test from "node:test"
import assert from "node:assert/strict"
import { routeForSheetOperation, toSheetOperationMessage } from "../src/sheetRoutes.ts"

test("core HP and hit dice operations retain wire routes", () => {
  assert.equal(routeForSheetOperation({type:"character.hp.damage",characterId:"a",amount:5}),"characters/sheet/hp")
  assert.equal(routeForSheetOperation({type:"character.hitDice.use",characterId:"a",side:"d8",amount:1}),"characters/sheet/hitdice")
})
test("shared routing preserves envelope discriminators", () => {
  const operation = {type:"character.stat.experience.set",characterId:"a",value:500}
  assert.deepEqual(toSheetOperationMessage(operation), {
    type:"session.sheet.operation",
    route:"characters/sheet/stats/experience",
    operation,
  })
})
test("condition and rest route matching", () => {
  assert.equal(routeForSheetOperation({type:"character.condition.remove",characterId:"a",conditionId:"b"}),"characters/sheet/conditions")
  assert.equal(routeForSheetOperation({type:"character.rest.long",characterId:"a"}),"characters/sheet/rest")
})
test("unknown operation types fail closed", () => {
  assert.throws(() => routeForSheetOperation({type:"session.unknown",characterId:"a"}),/No character sheet route/)
})
