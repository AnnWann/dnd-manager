import type { AbilityActionKind, AbilityKind, Trigger } from "../abilities/Ability"
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

export interface CustomAbilityActivationDefinition {
  kind?: AbilityKind
  actionKind?: AbilityActionKind
  actionKindFieldId?: string
  trigger?: Trigger
  triggerFieldId?: string
  /** @deprecated Use resourceChanges com operation='spend'. */
  resourceCosts?: CustomResourceCostDefinition[]
  resourceChanges?: CustomAbilityResourceChangeDefinition[]
  usage?: CustomUsageDefinition
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
  amount?: number
  formula?: FormulaExpression
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
