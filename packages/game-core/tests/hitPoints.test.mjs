import test from "node:test"
import assert from "node:assert/strict"
import { applyHitPointDamage, applyHitPointHealing, applyTemporaryHitPoints } from "../src/hitPoints.ts"
import { addDeathSaveSuccess, addDeathSaveFailure, resetDeathSaveState } from "../src/deathSaves.ts"

test("temporary HP absorbs damage before current HP", () => {
  assert.deepEqual(applyHitPointDamage({current: 12, temporary: 5}, 8), {current: 9, temporary: 0})
  assert.deepEqual(applyHitPointDamage({current: 12, temporary: 5}, 3), {current: 12, temporary: 2})
})
test("healing respects maximum and nonnegative amount", () => {
  assert.equal(applyHitPointHealing({current: 7, temporary: 2}, 20, 12).current, 12)
  assert.equal(applyHitPointHealing({current: 7, temporary: 2}, -3, 12).current, 7)
})
test("temporary hit points replace only if larger", () => {
  assert.equal(applyTemporaryHitPoints({current: 7, temporary: 5}, 3).temporary, 5)
  assert.equal(applyTemporaryHitPoints({current: 7, temporary: 5}, 8).temporary, 8)
})
test("death saves cap at three and preserve the other counter", () => {
  assert.deepEqual(addDeathSaveSuccess({successes: 3, failures: 1}), {successes: 3, failures: 1})
  assert.deepEqual(addDeathSaveFailure({successes: 2, failures: 3}), {successes: 2, failures: 3})
  assert.deepEqual(resetDeathSaveState(), {successes: 0, failures: 0})
})
