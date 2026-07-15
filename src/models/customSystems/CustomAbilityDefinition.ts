import type { AbilityActionKind, AbilityKind, Trigger } from "../abilities/Ability"
import type { CustomCondition } from "./CustomAutomationDefinition"
import type { CustomFieldDefinition } from "./CustomFieldDefinition"
import type { FormulaExpression } from "./CustomGenerals"

export interface CustomAbilityTypeDefinition {
  id: string
  name: string
  description?: string
  icon?: string
  fields: CustomFieldDefinition[]
  display: CustomAbilityDisplayDefinition
  activation?: CustomAbilityActivationDefinition
  visibility?: CustomCondition
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