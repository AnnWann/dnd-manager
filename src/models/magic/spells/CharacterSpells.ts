import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { Spell } from "./Spell"
import type { MagicCircleLevel } from "./spellDefinitions"

export type CharacterSpells = {
  knownSpells: Spell[]
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}