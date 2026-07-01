import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"

export type CharacterSpells = {
  knownSpells: {
    source: SpellSource,
    spells: {
      id: string,
      prepared: boolean
    }
  }[]
  castingDescriptions?: Record<string, string[]>
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}