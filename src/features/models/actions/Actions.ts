

export type ActionType = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistence' | 'interaction' | 'free'

export type ActionsPerTurn = Record<ActionType, number>