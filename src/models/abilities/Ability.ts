import type { BonusCollection } from "../bonuses/Bonus"
import type { CharacterAcquisitionMetadata } from "../characters/CharacterAcquisition"
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
  /** Por quanto tempo as mini-habilidades escolhidas permanecem disponíveis. */
  duration?: CharacterConditionDuration
  /**
   * Mini-habilidades completas concedidas quando esta opção é escolhida.
   * Cada uma mantém seu próprio tipo, ação, gatilho, duração de efeito,
   * contador, bônus, proficiências, magias e condição ao usar.
   */
  abilities?: Ability[]
  /** Formato de uma única mini-habilidade; mantido para compatibilidade. */
  ability?: Ability
  /** Formato legado das primeiras opções; mantido para migração transparente. */
  condition?: CharacterConditionGrant
}

export type AbilityResourceCostKind =
  | "spellSlot"
  | "pactSlot"
  | "ki"
  | "sorceryPoints"
  | "channelDivinity"
  | "customSpellSlot"
  | "customSystem"

export type AbilityResourceCostGroupMode = "all" | "oneOf"

export interface AbilityResourceUpcastDefinition {
  enabled: boolean
  /** Nível de referência da habilidade antes de escalar. */
  baseLevel: number
  /** Limite opcional do nível escolhido na ativação. */
  maximumLevel?: number
}

export interface AbilityResourceCostDefinition {
  id: string
  kind: AbilityResourceCostKind
  /** Quantidade base consumida. Espaços normalmente usam 1. */
  amount: number
  /** Nível do espaço na ativação base. */
  slotLevel?: number
  /** Quantidade adicional consumida por nível de upcast. */
  amountPerLevel?: number
  /** Referência para pools de espaços de uma classe customizada. */
  poolId?: string
  poolName?: string
  /** Referência para recursos de Custom Systems. */
  systemId?: string
  resourceId?: string
  systemName?: string
  resourceName?: string
}

export interface AbilityResourceCostGroup {
  id: string
  /** all = E; oneOf = OU. Todos os grupos, por sua vez, são cumulativos (E). */
  mode: AbilityResourceCostGroupMode
  costs: AbilityResourceCostDefinition[]
}

export interface AbilityResourceSelection {
  /** Nível escolhido quando a habilidade permite upcast/escalonamento. */
  activationLevel?: number
  /** Em grupos OU, mapeia groupId para o costId escolhido. */
  alternatives?: Record<string, string>
}

export interface Ability {
  id: string
  name: string
  description?: string
  usage?: Usage
  /** Custos externos consumidos atomicamente ao ativar a habilidade. */
  resourceCosts?: AbilityResourceCostGroup[]
  /** Permite escolher um nível maior no momento do uso. */
  resourceUpcast?: AbilityResourceUpcastDefinition
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
  /** Audit trail describing when and why the character obtained this ability. */
  acquisition?: CharacterAcquisitionMetadata
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

export type AbilityCategory =
  | 'general'
  | 'asi'
  | 'invocation'
  | 'feat'
  | 'channelDivinity'
  | 'martialArts'

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
