import type { CharacterClassInterface } from "../../sheet/Class";
import type { MagicCircleLevel } from "./spellDefinitions";

const WARLOCK_PACT_SLOTS: Record<number, { level: MagicCircleLevel; max: number }> = {
  1: { level: 1, max: 1 },
  2: { level: 1, max: 2 },
  3: { level: 2, max: 2 },
  4: { level: 2, max: 2 },
  5: { level: 3, max: 2 },
  6: { level: 3, max: 2 },
  7: { level: 4, max: 2 },
  8: { level: 4, max: 2 },
  9: { level: 5, max: 2 },
  10: { level: 5, max: 2 },
  11: { level: 5, max: 3 },
  12: { level: 5, max: 3 },
  13: { level: 5, max: 3 },
  14: { level: 5, max: 3 },
  15: { level: 5, max: 3 },
  16: { level: 5, max: 3 },
  17: { level: 5, max: 4 },
  18: { level: 5, max: 4 },
  19: { level: 5, max: 4 },
  20: { level: 5, max: 4 },
}

export function derivePactSlotsFromClasses(
  classes: CharacterClassInterface[],
): {
  level: MagicCircleLevel
  max: number
  current: number
} | undefined {
  const warlock = classes.find((c) => c.className === "warlock")

  if (!warlock) return undefined

  const pact = WARLOCK_PACT_SLOTS[warlock.level]

  return {
    level: pact.level,
    max: pact.max,
    current: pact.max,
  }
}