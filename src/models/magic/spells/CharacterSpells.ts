import type { CharacterAcquisitionMetadata } from "../../characters/CharacterAcquisition"
import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"

export type CharacterKnownSpell = {
  source: SpellSource
  spells: {
    id: string
    prepared: boolean
  }
  acquisition?: CharacterAcquisitionMetadata
}

export type CharacterSpells = {
  knownSpells: CharacterKnownSpell[]
  castingDescriptions?: Record<string, string[]>
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}
