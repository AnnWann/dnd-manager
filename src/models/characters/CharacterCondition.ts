import type { BonusCollection } from "../bonuses/Bonus"
import type { SpellGrant } from "../magic/spells/SpellGrant"
import type { Proficiency } from "../sheet/Proficiency"

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

/**
 * Template reaproveitável por habilidades. O id/source/createdAt são definidos
 * quando a condição é realmente aplicada ao personagem.
 */
export type CharacterConditionGrant = {
  name: string
  description?: string
  behavior?: string
  notes?: string
  tags?: string[]
  bonuses?: BonusCollection
  grantedSpells?: SpellGrant[]
  grantedProficiencies?: Proficiency[]
  duration?: CharacterConditionDuration
}

export type CharacterCondition = {
  id: string
  name: string
  description: string
  behavior: string
  source: string
  notes: string
  tags: string[]
  bonuses?: BonusCollection
  /** Benefícios dinâmicos que existem somente enquanto a condição existir. */
  grantedSpells?: SpellGrant[]
  grantedProficiencies?: Proficiency[]
  duration: CharacterConditionDuration
  createdAt: string

  /** Vínculo criado automaticamente por habilidades duradouras. */
  sourceAbilityId?: string
  sourceAbilityLocation?: "character" | "race" | "equipment"
  sourceItemId?: string
  sourceAbilityOptionId?: string

  /** Reserved for the future encounter / initiative system. */
  sourceCharacterId?: string
  linkedCombatantId?: string
  initiativeEffectId?: string
}
