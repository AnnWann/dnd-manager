import test from "node:test"
import assert from "node:assert/strict"
import { calculateExperienceProgress } from "../src/experience.ts"

test("level five XP thresholds and progress", () => {
  const value = calculateExperienceProgress(10000, 5)
  assert.equal(value.levelStartExperience, 6500)
  assert.equal(value.nextLevelExperience, 14000)
  assert.equal(value.experienceIntoLevel, 3500)
  assert.equal(value.experienceRemaining, 4000)
  assert.equal(value.canLevelUp, false)
})
test("level twenty has no next level", () => {
  const value = calculateExperienceProgress(355000, 20)
  assert.equal(value.nextLevelExperience, undefined)
  assert.equal(value.progressPercent, 100)
  assert.equal(value.canLevelUp, false)
})
test("progress is clamped while level-up remains available", () => {
  const value = calculateExperienceProgress(14000, 5)
  assert.equal(value.progressPercent, 100)
  assert.equal(value.canLevelUp, true)
})
