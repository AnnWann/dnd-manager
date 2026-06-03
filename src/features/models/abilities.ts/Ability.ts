export interface Ability {
  id: string
  name: string
  description?: string
  usage?: AbilityUsage
  kind?: AbilityKind
  actionKind?: AbilityActionKind
  trigger?: AbilityTrigger
}

export interface AbilityUsage {
  max: number
  used: number
  reset: AbilityUsageResetKind
  cooldownAmount?: number
  cooldownUnit?: AbilityUsageCooldownUnit
  cooldownRemaining?: number
}

export type AbilityUsageResetKind = 'turn' | 'cooldown' | 'shortRest' | 'longRest'

export type AbilityUsageCooldownUnit = 'turns' | 'minutes' | 'hours' | 'days' | 'tenDays'

export type AbilityKind = 'active' | 'passive'

export type AbilityActionKind = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'free'

export type AbilityTrigger =
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