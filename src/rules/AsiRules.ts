import type { ClassName } from "../models/sheet/Class"

const STANDARD_ASI_LEVELS = new Set([4, 8, 12, 16, 19])
const FIGHTER_ASI_LEVELS = new Set([4, 6, 8, 12, 14, 16, 19])
const ROGUE_ASI_LEVELS = new Set([4, 8, 10, 12, 16, 19])

const ASI_LEVELS_BY_CLASS: Partial<Record<ClassName, ReadonlySet<number>>> = {
  artificer: STANDARD_ASI_LEVELS,
  fighter: FIGHTER_ASI_LEVELS,
  rogue: ROGUE_ASI_LEVELS,
}

/** Structural 5e ASI progression; feat content itself remains user-provided. */
export function isAsiLevel(className: ClassName, classLevel: number): boolean {
  const level = Math.max(1, Math.min(20, Math.trunc(classLevel || 1)))
  return (ASI_LEVELS_BY_CLASS[className] ?? STANDARD_ASI_LEVELS).has(level)
}
