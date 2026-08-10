import type { ClassName } from "../models/sheet/Class"

const STANDARD_ASI_LEVELS = new Set([4, 8, 12, 16, 19])
const FIGHTER_ASI_LEVELS = new Set([4, 6, 8, 12, 14, 16, 19])
const ROGUE_ASI_LEVELS = new Set([4, 8, 10, 12, 16, 19])

/** Structural 5e ASI progression; feat content itself remains user-provided. */
export function isAsiLevel(className: ClassName, classLevel: number): boolean {
  const level = Math.max(1, Math.min(20, Math.trunc(classLevel || 1)))
  if (className === "fighter") return FIGHTER_ASI_LEVELS.has(level)
  if (className === "rogue") return ROGUE_ASI_LEVELS.has(level)
  return STANDARD_ASI_LEVELS.has(level)
}
