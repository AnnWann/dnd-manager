import type { CharacterAcquisitionMetadata } from "../../characters/CharacterAcquisition"
import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"
import type { SpellResourceCost } from "./Spell"

export type CharacterSpellResourceConfig = {
  useSlots: boolean
  resources: SpellResourceCost[]
}

export type CharacterKnownSpell = {
  source: SpellSource
  spells: {
    id: string
    prepared: boolean
    resourceCostOverride?: SpellResourceCost | SpellResourceCost[] | CharacterSpellResourceConfig | null
  }
  acquisition?: CharacterAcquisitionMetadata
}

export type CharacterSpells = {
  knownSpells: CharacterKnownSpell[]
  castingDescriptions?: Record<string, string[]>
  resourceCostOverrides?: Record<string, SpellResourceCost | SpellResourceCost[] | CharacterSpellResourceConfig | null>
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}
