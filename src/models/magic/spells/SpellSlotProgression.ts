// models/magic/spells/spellSlotProgression.ts

import type { CharacterClassInterface } from "../../sheet/Class"
import type { Slot } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"

const FULL_CASTER_SLOTS: Record<number, Partial<Record<MagicCircleLevel, number>>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
}

export function getCasterLevel(classes: CharacterClassInterface[]): number {
  return classes.reduce((total, classData) => {
    if (classData.className === "warlock") return total

    if (classData.spellcastingProgression === "full") {
      return total + classData.level
    }

    if (classData.spellcastingProgression === "half") {
      return total + Math.floor(classData.level / 2)
    }

    if (classData.spellcastingProgression === "third") {
      return total + Math.floor(classData.level / 3)
    }

    return total
  }, 0)
}

export function deriveLeveledSlotsFromClasses(
  classes: CharacterClassInterface[],
): Partial<Record<MagicCircleLevel, Slot>> {
  const casterLevel = Math.min(20, Math.max(0, getCasterLevel(classes)))
  const progression = FULL_CASTER_SLOTS[casterLevel] ?? {}

  return Object.fromEntries(
    Object.entries(progression).map(([level, max]) => [
      Number(level),
      {
        max,
        current: max,
      },
    ]),
  ) as Partial<Record<MagicCircleLevel, Slot>>
}