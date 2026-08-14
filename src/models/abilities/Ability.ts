import type { BonusCollection } from "../bonuses/Bonus"
import type {
  CharacterConditionDuration,
  CharacterConditionGrant,
} from "../characters/CharacterCondition"
import type { SpellGrant } from "../magic/spells/SpellGrant"
import type { Proficiency } from "../sheet/Proficiency"

export type AbilityActivationOption = {
  id: string
  /** Rótulo exibido no modal de escolha. */
  name: string
  /** Texto curto exibido antes da escolha. */
  description?: string
  /** Por quanto tempo a mini-habilidade escolhida permanece disponível. */
  duration?: CharacterConditionDuration
  /**
   * Mini-habilidade completa concedida quando esta opção é escolhida.
   * Ela mantém seu próprio tipo, ação, gatilho, duração de efeito, contador,
   * bônus, proficiências, magias e condição ao usar.
   */
  ability?: Ability
  /** Formato legado das primeiras opções; mantido para migração transparente. */
  condition?: CharacterConditionGrant
}

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
  /** Condição adicional aplicada ao personagem quando a habilidade é usada. */
  conditionOnUse?: CharacterConditionGrant
  /** Alternativas apresentadas ao jogador antes de concluir a ativação. */
  activationOptions?: AbilityActivationOption[]
  /** Estado persistido dos benefícios de habilidades que precisam ser acionadas. */
  benefitsActive?: boolean
  /** Campo legado; novos cálculos usam benefitsActive. */
  modifiersActive?: boolean
  /** Metadados presentes nas habilidades projetadas por outras fontes. */
  source?: "equipment" | "race" | "condition" | string
  sourceItemId?: string
  sourceItemName?: string
  sourceConditionId?: string
  sourceConditionName?: string
  originalAbilityId?: string
}

export interface Usage {
  max: number
  /** Fórmula opcional; quando válida, substitui max nos cálculos. */
  maxFormula?: string
  used: number
  reset: AbilityUsageResetKind
  /** Habilidades com o mesmo id compartilham o mesmo contador de usos. */
  sharedResourceId?: string
  /** Nome amigável exibido na interface para o recurso compartilhado. */
  sharedResourceName?: string
  cooldownAmount?: number
  cooldownUnit?: AbilityUsageCooldownUnit
  cooldownRemaining?: number
}

export type AbilityCategory = 'general' | 'invocation' | 'feat' | 'channelDivinity' | 'martialArts'

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
