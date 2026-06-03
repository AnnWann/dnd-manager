import type { Attribute } from "../../sheet/Attribute"
import type { DurationUnit } from "../../units/DurationUnit"
import type { Effect } from "../../Effects/Effect"
import type { ActionType } from "../../actions/Actions"
import type { RollType } from "../../dice/RollType"
import type { ClassName } from "../../sheet/Class"
import type { Die } from "../../dice/Die"

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
  area: {
    self: boolean
    shape?: 'square' | 'circle' | 'cone' | 'line'
    size?: number
  }
  duration: {
    value: number 
    unit: DurationUnit
  }
  

  damageDice?: Die
  concentration: boolean
  prepared: boolean
  components: ('V' | 'S' | 'M')[]
  material?: string

  higherLevel: {
    mode: 'dice' | 'quantity' | 'none'
    dicePerLevel?: number
    quantityPerLevel?: number
    higherLevelText: string
  }
 
  effects: Effect
}

export type SpellSource = {
  type: SpellSourceType
  name: string
  attribute: Attribute
  sourceId: string
}

export type SpellSourceType = 'class' | 'feat' | 'ability'

export type MagicCircleLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type MagicSchool = 
  | ''
  | ''