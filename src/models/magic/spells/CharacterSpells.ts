import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"
import type { SpellResourceCost } from "./Spell"

export type CharacterSpellResourceConfig = {
  useSlots: boolean
  resources: SpellResourceCost[]
}

export type CharacterSpells = {
  knownSpells: {
    source: SpellSource,
    spells: {
      id: string,
      prepared: boolean
      resourceCostOverride?: SpellResourceCost | SpellResourceCost[] | CharacterSpellResourceConfig | null
    }
  }[]
  castingDescriptions?: Record<string, string[]>
  resourceCostOverrides?: Record<string, SpellResourceCost | SpellResourceCost[] | CharacterSpellResourceConfig | null>
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}