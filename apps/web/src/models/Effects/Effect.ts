import type { ActionType } from "../actions/Actions"
import type { Die } from "../dice/Die"
import type { RollType } from "../dice/RollType"
import type { Attribute } from "../sheet/Attribute"
import type { ConditionType } from "../states/ConditionTypes"


export interface Effect {
  target: string 
  rollDice?: Die 
  rollAppliesTo?: RollType[]
  attribute?: Attribute
}

export interface ConditionEffect extends Effect {
  condition: ConditionType
}

export interface ValueEffect extends Effect {
  value: number
  operation: 'add' | 'sub' | 'set' | 'div'
}

export interface ConditionalDamageEffect extends Effect {
  when: string
  damageDice: Die
}

export interface movementEffect extends Effect {
  direction: 'any' | 'towards' | 'away' | 'direction'
  reference: string
  directionText: string
}

export interface economyEffect extends Effect {
  type: ActionType | 'movement' | 'turn'
  value?: number
  operation: 'add' | 'sub' | 'set' | 'div'
}


