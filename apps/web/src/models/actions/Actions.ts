

export type ActionType = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'interaction' | 'free'

export type ActionsPerTurn = Record<ActionType, number>