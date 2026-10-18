import type { AbilityActionKind, AbilityKind, Trigger } from "../abilities/Ability"
import type { BonusCollection } from "../bonuses/Bonus"
import type { CharacterConditionDuration } from "../characters/CharacterCondition"
import type { CustomCondition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { FormulaExpression, JsonValue } from "./CustomGenerals"
import type { Attribute } from "../sheet/Attribute"
import type { Skill } from "../sheet/Skills"

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

export interface CustomActivationLevelDefinition {
  /** Minimum/default level used when the ability/action is activated. */
  baseLevel: number
  /** Optional upper limit. Omit for no explicit maximum. */
  maximumLevel?: number
  /** Optional player-facing label. Defaults to "Nível de uso". */
  label?: string
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
  /**
   * When true on a predefined ability override, disables the roll inherited
   * from the ability type. This is separate from an absent roll, which means
   * "inherit the type default".
   */
  rollDisabled?: boolean
  /** @deprecated Use resourceChanges com operation='spend'. */
  resourceCosts?: CustomResourceCostDefinition[]
  resourceChanges?: CustomAbilityResourceChangeDefinition[]
  /** Estados aplicados/removidos quando a habilidade é usada. */
  conditionChanges?: CustomAbilityConditionChangeDefinition[]
  usage?: CustomUsageDefinition
  /**
   * Enables a selectable activation level (upcast). The selected level is
   * available to formulas as activation.level and ability.level.
   */
  level?: CustomActivationLevelDefinition
}

export type CustomAbilityRollKind =
  | "generic"
  | "attack"
  | "abilityCheck"
  | "savingThrow"
  | "targetSave"
  | "damage"

export type CustomAbilityD20Mode =
  | "normal"
  | "advantage"
  | "disadvantage"

export type CustomRollAttributeFieldReference = {
  scope: "system" | "ability"
  fieldId: string
}

export interface CustomAbilityDamageRollDefinition {
  id: string
  label?: string
  /** Dado do dano. Aceita literal (2d6+1) ou variável do tipo Dado. */
  dice: string
  /** Tipo livre para permitir dano padrão ou tipos homebrew. */
  damageType?: string
  /** Soma um valor calculado depois dos dados. */
  modifierFormula?: FormulaExpression
  /**
   * Dados adicionais rolados uma vez para cada nível de ativação acima do
   * nível-base. Ex.: dano 2d6 com upcastDicePerLevel=1d6 vira 4d6 no nível 3
   * quando o nível-base da ativação é 1.
   */
  upcastDicePerLevel?: string
  /**
   * Sobrescreve apenas para este dano o nível a partir do qual o upcast começa.
   * Se ausente, usa activation.level.baseLevel.
   */
  upcastBaseLevel?: number
  /** Em um ataque crítico, dobra os dados deste componente. Padrão: true. */
  critical?: boolean
}

export interface CustomAbilityRollDefinition {
  /**
   * automatic: o sistema resolve os dados.
   * manual: o jogador informa os resultados obtidos com dados físicos.
   */
  mode: "automatic" | "manual"
  /**
   * Sem kind, definições antigas continuam funcionando como rolagem genérica.
   */
  kind?: CustomAbilityRollKind
  /** Notação de dados para rolagens genéricas. Rolagens d20 usam 1d20 automaticamente. */
  dice?: string
  /** Rótulo exibido ao jogador. */
  label?: string
  /** Normal/vantagem/desvantagem para ataque, teste ou salvaguarda do usuário. */
  d20Mode?: CustomAbilityD20Mode
  /** Atributo fixo usado por ataque, teste de atributo ou salvaguarda. */
  attribute?: Attribute
  /** Campo do tipo attribute que substitui attribute dinamicamente. */
  attributeField?: CustomRollAttributeFieldReference
  /** Perícia usada quando kind=abilityCheck. Se presente, prevalece sobre attribute. */
  skill?: Skill
  /** Para ataques, soma proficiência ao modificador do atributo. Padrão: true. */
  proficient?: boolean
  /** Bônus adicional calculado e somado ao total principal. */
  modifierFormula?: FormulaExpression
  /** Atributo da resistência exigida do alvo quando kind=targetSave. */
  saveAttribute?: Attribute
  /**
   * Atributo do usuário usado para calcular a CD automática do efeito.
   * Ex.: uma Técnica Marcial pode exigir resistência de CON do alvo, mas usar
   * FOR do usuário para a CD: 8 + proficiência + FOR.
   */
  dcAttribute?: Attribute
  /** Campo do tipo attribute que substitui dcAttribute dinamicamente. */
  dcAttributeField?: CustomRollAttributeFieldReference
  /**
   * CD da resistência do alvo. Se ausente, usa
   * 8 + proficiência + modificador de dcAttribute (ou attribute por
   * compatibilidade) e aplica os bônus de CD da ficha.
   */
  dcFormula?: FormulaExpression
  /** O que acontece com o dano quando o alvo passa na resistência. */
  onSave?: "none" | "half" | "full"
  /** Componentes de dano que podem acompanhar qualquer comportamento. */
  damage?: CustomAbilityDamageRollDefinition[]
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
