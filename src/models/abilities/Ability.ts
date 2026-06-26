import type { BonusCollection } from "../bonuses/Bonus"
import type { SpellGrant } from "../magic/spells/SpellGrant"

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
  bonuses?: BonusCollection

  /** Stable identifier of the class feature, choice or template that created it. */
  sourceAbilityId?: string

  /** Version of the source definition used to create the ability. */
  sourceVersion?: number

  /** True when player-provided details override the source definition. */
  customized?: boolean
}

export interface Usage {
  max: number
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
