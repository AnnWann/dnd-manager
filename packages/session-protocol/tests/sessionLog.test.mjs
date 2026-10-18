import test from "node:test"
import assert from "node:assert/strict"
import { sessionLogScopes, isLatestUndoableSessionLog } from "../src/sessionLog.ts"

const log = (id, type, characterId, extras = {}) => ({
  id, operation: {type}, reverseOperation: {type:"character.hp.restore", characterId}, ...extras,
})

test("shared scope extraction recognizes mission and inventory operations", () => {
  assert.deepEqual(sessionLogScopes(log("a","mission.add","session")), ["character:session","missions:shared"])
  assert.deepEqual(sessionLogScopes(log("b","party.item.add","session")), ["character:session","inventory:shared"])
})
test("transfer covers both source and destination character scopes", () => {
  const transfer=log("a","inventory.item.transfer","session",{
    operation: {type:"inventory.item.transfer",request:{from:{type:"character",characterId:"a"},to:{type:"character",characterId:"b"}}},
  })
  assert.deepEqual(sessionLogScopes(transfer),["character:session","character:a","character:b"])
})
test("later conflicting edits block undo while independent scopes remain undoable", () => {
  const first=log("1","character.hp.damage","a")
  const unrelated=log("2","character.hp.damage","b")
  const conflict=log("3","character.hp.heal","a")
  assert.equal(isLatestUndoableSessionLog([first,unrelated],first),true)
  assert.equal(isLatestUndoableSessionLog([first,unrelated,conflict],first),false)
  assert.equal(isLatestUndoableSessionLog([first,unrelated,conflict],unrelated),true)
})
test("undone operations cannot be reversed again", () => {
  const target=log("1","character.hp.damage","a",{undoneAt:"now"})
  assert.equal(isLatestUndoableSessionLog([target],target),false)
})
