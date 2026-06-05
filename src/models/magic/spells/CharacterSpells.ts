import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { Spell } from "./Spell"
import type { MagicCircleLevel } from "./spellDefinitions"

export type CharacterSpells = {
  Spells: Spell[]
  Slots: Record<MagicCircleLevel, LeveledSlots>
  PactSlots: LeveledSlots
}