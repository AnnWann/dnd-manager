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
}

export interface CustomAbilityDisplayDefinition {
  titleFieldId: string
  subtitleFieldIds?: string[]
  descriptionFieldId?: string
  badgeFieldIds?: string[]
}

export interface CustomAbilityActivationDefinition {
  kind?: AbilityKind
  actionKind?: AbilityActionKind
  actionKindFieldId?: string
  trigger?: Trigger
  triggerFieldId?: string
  resourceCosts?: CustomResourceCostDefinition[]
  usage?: CustomUsageDefinition
}

export interface CustomResourceCostDefinition {
  resourceId: string
  amount?: number
  formula?: FormulaExpression
}

export interface CustomUsageDefinition {
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
