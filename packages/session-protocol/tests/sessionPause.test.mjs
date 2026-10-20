import assert from "node:assert/strict"
import test from "node:test"
import {
  isSessionPlayerOperationBlocked,
  parseSessionPauseMessage,
  parseSessionPauseServerMessage,
} from "../../../apps/web/src/shared/session-runtime/sessionPause.ts"

test("master alone can keep changing state while the session is paused", () => {
  const mutations = [
    "session.hp.operation", "session.abilities.operation", "session.action.roll",
    "session.creature.roll", "session.companions.operation", "session.initiative.operation",
    "session.magic.operation", "session.sheet.operation", "session.inventory.operation",
    "session.missions.operation", "session.log.undo", "session.config.publish",
  ]
  for (const type of mutations) {
    assert.equal(isSessionPlayerOperationBlocked(true, "PLAYER", type), true, type)
    assert.equal(isSessionPlayerOperationBlocked(true, "MASTER", type), false, type)
    assert.equal(isSessionPlayerOperationBlocked(false, "PLAYER", type), false, type)
  }
  assert.equal(isSessionPlayerOperationBlocked(true, "PLAYER", "session.heartbeat"), false)
  assert.equal(isSessionPlayerOperationBlocked(true, "PLAYER", "session.ping"), false)
  assert.equal(isSessionPlayerOperationBlocked(true, "PLAYER", undefined), true)
})

test("pause control rejects malformed input, including strings that look like booleans", () => {
  assert.deepEqual(parseSessionPauseMessage('{"type":"session.pause.set","paused":true}'), { type: "session.pause.set", paused: true })
  assert.deepEqual(parseSessionPauseMessage('{"type":"session.pause.set","paused":false}'), { type: "session.pause.set", paused: false })
  assert.equal(parseSessionPauseMessage('{"type":"session.pause.set","paused":"true"}'), null)
  assert.equal(parseSessionPauseMessage('{"type":"session.pause.set"}'), null)
  assert.equal(parseSessionPauseMessage("not json"), null)
})

test("pause state broadcast validates its shape for reconnections", () => {
  const state = { paused: true, updatedAt: "2026-10-20T10:00:00.000Z", updatedBy: "master-1" }
  assert.deepEqual(parseSessionPauseServerMessage(JSON.stringify({ type: "session.pause.state", state })), { type: "session.pause.state", state })
  assert.equal(parseSessionPauseServerMessage(JSON.stringify({ type: "session.pause.state", state: { paused: "yes" } })), null)
})
