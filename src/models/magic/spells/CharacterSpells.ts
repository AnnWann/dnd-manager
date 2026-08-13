import type { Slot as LeveledSlots } from "./LeveledSlots"
import type { MagicCircleLevel } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"

export type CharacterSpells = {
  knownSpells: {
    source: SpellSource,
    spells: {
      id: string,
      prepared: boolean
      resourceCostOverride?: {
        resource: "ki" | "sorceryPoints" | "channelDivinity"
        amount: number
      } | null
    }
  }[]
  castingDescriptions?: Record<string, string[]>
  resourceCostOverrides?: Record<string, {
    resource: "ki" | "sorceryPoints" | "channelDivinity"
    amount: number
  } | null>
  slots: Partial<Record<MagicCircleLevel, LeveledSlots>>
  pactSlots: LeveledSlots
}