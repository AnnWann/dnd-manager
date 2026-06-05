import type { DurationUnit } from "../../units/DurationUnit"
import type { Effect } from "../../Effects/Effect"
import type { ActionType } from "../../actions/Actions"
import type { RollType } from "../../dice/RollType"
import type { ClassName } from "../../sheet/Class"
import type { Die } from "../../dice/Die"
import type { MagicCircleLevel, MagicSchool } from "./spellDefinitions"
import type { SpellSource } from "./SpellSource"
import type { Attribute } from "../../sheet/Attribute"



export type Spell = {
  index: string
  name: string
  description: string
  higherLevelText: string
  source: SpellSource
  
  displayName?: string
  headcanon?: string
  homebrew: boolean

  slotLevel: MagicCircleLevel
  school: MagicSchool
  classes: ClassName

  rollMode: RollType[]
  actionType: ActionType
  reactionWhen?: string

  range: string
  duration: {
    value: number 
    unit: DurationUnit
  }
  

  damageDice?: Die
  concentration: boolean
  prepared: boolean
  components: ('V' | 'S' | 'M')[]
  material?: string

  targeting: SpellTargeting 
  effects: Effect
}

export type SpellTargeting = {
  kind: 'self' | 'single-creature' | 'multiple-creatures' | 'area' | 'object' | 'special'
  targetsSelf: boolean

  targetCount?: number
  canTargetMoreAtHigherLevels?: boolean

  hasAttackRoll: boolean
  hasSavingThrow: boolean
  savingThrowAttribute?: Attribute

  affectsArea: boolean
  areaShape?: 'square' | 'circle' | 'cone' | 'line'
  areaSize?: number
}