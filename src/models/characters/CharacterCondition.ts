export type ConditionDurationType =
  | "rounds"
  | "turns"
  | "minutes"
  | "hours"
  | "days"
  | "until-start-of-turn"
  | "until-end-of-turn"
  | "until-save"
  | "concentration"
  | "permanent"
  | "custom"

export type ConditionTickTiming =
  | "start-of-turn"
  | "end-of-turn"
  | "manual"

export type ConditionTickOwner =
  | "affected"
  | "source"

export type CharacterConditionDuration = {
  type: ConditionDurationType
  total?: number
  remaining?: number
  tickOn?: ConditionTickTiming
  tickOwner?: ConditionTickOwner
  autoRemoveAtZero?: boolean
  customLabel?: string
  expiresAt?: string
}

export type CharacterCondition = {
  id: string
  name: string
  description: string
  behavior: string
  source: string
  notes: string
  tags: string[]
  duration: CharacterConditionDuration
  createdAt: string

  /** Reserved for the future encounter / initiative system. */
  sourceCharacterId?: string
  linkedCombatantId?: string
  initiativeEffectId?: string
}
