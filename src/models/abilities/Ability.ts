import type { BonusCollection } from "../bonuses/Bonus"
import type { SpellGrant } from "../magic/spells/SpellGrant"
import type { Proficiency } from "../sheet/Proficiency"

export interface Ability {
  id: string
  name: string
  description?: string
  usage?: Usage
  kind?: AbilityKind
  category?: AbilityCategory
  actionKind?: AbilityActionKind
  trigger?: Trigger
  grantedSpells?: SpellGrant[]
  grantedProficiencies?: Proficiency[]
  bonuses?: BonusCollection
  /** Estado persistido dos benefícios de habilidades que precisam ser acionadas. */
  benefitsActive?: boolean
  /** Campo legado; novos cálculos usam benefitsActive. */
  modifiersActive?: boolean
  /** Metadados presentes nas habilidades projetadas por equipamentos. */
  source?: "equipment" | "race" | string
  sourceItemId?: string
  sourceItemName?: string
  originalAbilityId?: string
}

export interface Usage {
  max: number
  /** Fórmula opcional; quando válida, substitui max nos cálculos. */
  maxFormula?: string
  used: number
  reset: AbilityUsageResetKind
  cooldownAmount?: number
  cooldownUnit?: AbilityUsageCooldownUnit
  cooldownRemaining?: number
}

export type AbilityCategory = 'general' | 'invocation' | 'feat'

export type AbilityUsageResetKind = 'turn' | 'cooldown' | 'shortRest' | 'longRest' | 'limited' | 'spellSlot'

export type AbilityUsageCooldownUnit = 'turns' | 'minutes' | 'hours' | 'days' | 'tenDays'

export type AbilityKind = 'active' | 'passive'

export type AbilityActionKind = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'free'

export type Trigger =
  | 'startTurn'
  | 'endTurn'
  | 'startRound'
  | 'endRound'
  | 'onAttack'
  | 'onHit'
  | 'onCrit'
  | 'onMiss'
  | 'whenHit'
  | 'whenDamaged'
  | 'whenHealed'
  | 'whenTargeted'
  | 'whenConcentrating'
  | 'whenConcentrationEnds'
  | 'onSpellCast'
  | 'onSpellHit'
  | 'onSpellMiss'
  | 'onSave'
  | 'onFailedSave'
  | 'onSuccessfulSave'
  | 'onSkillCheck'
  | 'onInitiative'
  | 'onShortRest'
  | 'onLongRest'
  | 'onDodge'
  | 'onDropToZeroHp'
  | 'onDeathSave'
  | 'onAllyFalls'
  | 'onEnemyApproaches'
  | 'onCreatureEntersReach'
  | 'onCreatureLeavesReach'
  | 'whenBloodied'
  | 'whileMounted'
  | 'whileHidden'
  | 'whileProne'
  | 'whileGrappled'
  | 'whileSurprised'
  | 'always'
