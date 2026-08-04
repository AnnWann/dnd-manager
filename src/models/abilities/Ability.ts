import type { BonusCollection } from "../bonuses/Bonus"
import type { CharacterAcquisitionMetadata } from "../characters/CharacterAcquisition"
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
  effectDuration?: AbilityEffectDuration
  /** Texto livre exibido na condição criada por efeitos duradouros. */
  effectDurationText?: string
  /** Define se os benefícios somem ao término ou permanecem na ficha. */
  effectPersistence?: AbilityEffectPersistence
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
  /** Audit trail describing when and why the character obtained this ability. */
  acquisition?: CharacterAcquisitionMetadata
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

export type AbilityCategory = 'general' | 'invocation' | 'feat' | 'channelDivinity'

export type AbilityUsageResetKind = 'turn' | 'cooldown' | 'shortRest' | 'longRest' | 'limited' | 'spellSlot'

export type AbilityUsageCooldownUnit = 'turns' | 'minutes' | 'hours' | 'days' | 'tenDays'

export type AbilityKind = 'active' | 'passive' | 'feature'

export type AbilityActionKind = 'action' | 'bonusAction' | 'reaction' | 'legendaryAction' | 'legendaryReaction' | 'legendaryResistance' | 'free'

export type AbilityEffectDuration = 'instant' | 'lasting'

export type AbilityEffectPersistence = 'untilEnd' | 'permanent'

export type AbilityTriggerPreset =
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

export type Trigger = AbilityTriggerPreset | (string & {})
