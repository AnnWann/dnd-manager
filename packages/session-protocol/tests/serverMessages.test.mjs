import test from "node:test"
import assert from "node:assert/strict"
import {parseServerSessionMessage} from "../src/sessionMessages.ts"

test("accepts well-formed readiness and state snapshots", () => {
  assert.deepEqual(parseServerSessionMessage(JSON.stringify({type:"session.ready",sessionId:"s",clientId:"c",serverTime:123})),{type:"session.ready",sessionId:"s",clientId:"c",serverTime:123})
  assert.deepEqual(parseServerSessionMessage(JSON.stringify({type:"session.hp.snapshot",characters:[]})),{type:"session.hp.snapshot",characters:[]})
})
test("rejects malformed, unknown and incomplete base messages", () => {
  assert.equal(parseServerSessionMessage("{"),null)
  assert.equal(parseServerSessionMessage(JSON.stringify({type:"session.ready",sessionId:"s"})),null)
  assert.equal(parseServerSessionMessage(JSON.stringify({type:"session.hp.snapshot",characters:{}})),null)
  assert.equal(parseServerSessionMessage(JSON.stringify({type:"unknown"})),null)
})
test("does not change error message wire shape", () => {
  const message={type:"session.error",code:"DENIED",message:"Not allowed"}
  assert.deepEqual(parseServerSessionMessage(JSON.stringify(message)),message)
})
