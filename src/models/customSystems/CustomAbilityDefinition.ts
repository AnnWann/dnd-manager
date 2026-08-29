import type { AbilityActionKind, AbilityKind, Trigger } from "../abilities/Ability"
import type { BonusCollection } from "../bonuses/Bonus"
import type { CharacterConditionDuration } from "../characters/CharacterCondition"
import type { CustomCondition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { FormulaExpression, JsonValue } from "./CustomGenerals"

export interface CustomAbilityTypeDefinition {
  id: string
  name: string
  description?: string
  icon?: string
  fields: CustomFieldDefinition[]
  display: CustomAbilityDisplayDefinition
  activation?: CustomAbilityActivationDefinition
  acquisition?: CustomAbilityAcquisitionDefinition
  visibility?: CustomCondition
  /** Biblioteca definida pelo mestre. O jogador escolhe entradas desta lista para aprender/adicionar. */
  predefinedAbilities?: CustomPredefinedAbilityDefinition[]
  /** Presets de exceção de aquisição/preparo esperados para personagens específicos. */
  acquisitionExceptionPresets?: CustomAbilityAcquisitionExceptionPresetDefinition[]
  /** Mantém disponível a criação de uma habilidade completamente livre. Padrão: somente o mestre. */
  allowCustomCreation?: boolean
}

export interface CustomPredefinedAbilityDefinition {
  id: string
  values: Record<string, JsonValue>
  description?: string
  /** Permite sobrescrever o comportamento padrão do tipo para uma habilidade específica. */
  activation?: CustomAbilityActivationDefinition
  acquisition?: Partial<CustomAbilityAcquisitionDefinition>
}

export interface CustomAbilityDisplayDefinition {
  titleFieldId: string
  subtitleFieldIds?: string[]
  descriptionFieldId?: string
  badgeFieldIds?: string[]
}

export interface CustomAbilityAcquisitionDefinition {
  /** Concedida: sempre disponível. Aprendida: precisa ser adquirida. Preparada: escolhida após adquirir. */
  mode: 'granted' | 'learned' | 'prepared' | 'learnedAndPrepared'
  learnedLimit?: number
  learnedLimitFormula?: FormulaExpression
  preparedLimit?: number
  preparedLimitFormula?: FormulaExpression
  defaultLearned?: boolean
  defaultPrepared?: boolean
  preparationReset?: 'manual' | 'shortRest' | 'longRest'
}

export interface CustomAbilityAcquisitionExceptionPresetDefinition {
  id: string
  name: string
  description?: string
  learnedLimitFormulaOverride?: FormulaExpression
  preparedLimitFormulaOverride?: FormulaExpression
  extraLearnedSlots?: number
  extraPreparedSlots?: number
  /** Quantas habilidades o mestre normalmente deve marcar como sempre aprendidas ao aplicar o preset. */
  alwaysLearnedSelectionCount?: number
  /** Quantas habilidades o mestre normalmente deve marcar como sempre preparadas ao aplicar o preset. */
  alwaysPreparedSelectionCount?: number
}

export interface CustomAbilityActivationDefinition {
  kind?: AbilityKind
  actionKind?: AbilityActionKind
  actionKindFieldId?: string
  trigger?: Trigger
  triggerFieldId?: string
  /**
   * Rolagem opcional resolvida antes dos efeitos. Em modo automático, o
   * servidor rola `dice`. Em modo manual, o jogador informa o resultado ao
   * usar a habilidade. O resultado fica disponível nas fórmulas como
   * `roll.value`.
   */
  roll?: CustomAbilityRollDefinition
  /** @deprecated Use resourceChanges com operation='spend'. */
  resourceCosts?: CustomResourceCostDefinition[]
  resourceChanges?: CustomAbilityResourceChangeDefinition[]
  /** Estados aplicados/removidos quando a habilidade é usada. */
  conditionChanges?: CustomAbilityConditionChangeDefinition[]
  usage?: CustomUsageDefinition
}

export interface CustomAbilityRollDefinition {
  mode: 'automatic' | 'manual'
  /** Notação simples de dados, por exemplo 1d6, 2d8+1 ou 1d10-1. Obrigatória no modo automático e opcional como instrução no modo manual. */
  dice?: string
  /** Rótulo exibido ao jogador. Ex.: Recuperar Fôlego. */
  label?: string
}

export type CustomAbilityResourceReference =
  | {
      source: 'native'
      resource: 'hitPoints' | 'temporaryHitPoints' | 'inspiration' | 'exhaustion'
      /** Preserva o discriminante e permite acesso seguro em UIs que alternam pelo source. */
      resourceId?: never
      systemId?: never
    }
  | {
      source: 'customSystem'
      systemId: string
      resourceId: string
      /** Preserva o discriminante e permite acesso seguro em UIs que alternam pelo source. */
      resource?: never
    }

export interface CustomAbilityResourceChangeDefinition {
  id: string
  target: CustomAbilityResourceReference
  operation: 'spend' | 'gain' | 'set'
  /** Mantido para compatibilidade e valores numéricos simples. Fórmula tem precedência. */
  amount?: number
  formula?: FormulaExpression
  /**
   * Conector entre custos consecutivos. Ausente equivale a `and` para manter
   * compatibilidade com definições antigas. `or` inicia uma nova alternativa.
   */
  costJoin?: 'and' | 'or'
  /** Nível em que o custo base é aplicado quando a habilidade permite upcast. */
  upcastBaseLevel?: number
  /** Quantidade adicionada ao custo para cada nível acima de upcastBaseLevel. */
  upcastAmountPerLevel?: number
}

/**
 * Usa o mesmo conjunto de dados das condições da ficha. `amount` dentro de
 * duration é mantido apenas para compatibilidade com definições antigas.
 */
export interface CustomAbilityConditionChangeDefinition {
  id: string
  operation: 'add' | 'remove'
  name: string
  description?: string
  behavior?: string
  source?: string
  notes?: string
  tags?: string[]
  bonuses?: BonusCollection
  duration?: CharacterConditionDuration & { amount?: number }
  sourceCharacterId?: string
  linkedCombatantId?: string
}

export interface CustomResourceCostDefinition {
  resourceId: string
  amount?: number
  formula?: FormulaExpression
}

export interface CustomUsageDefinition {
  mode?: 'unlimited' | 'limited'
  maximum?: number
  maximumFormula?: FormulaExpression
  reset: CustomUsageResetKind
}

export type CustomUsageResetKind =
  | 'turn'
  | 'combat'
  | 'shortRest'
  | 'longRest'
  | 'manual'
  | 'never'
