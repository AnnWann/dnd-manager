import type { CustomCondition, CustomNumericOperation, CustomSystemEventType } from "./CustomAutomationDefinition"
import type { CustomSystemEditPermission, FormulaExpression } from "./CustomGenerals"

export interface CustomResourceDefinition {
  id: string
  name: string
  description?: string
  type: CustomResourceType
  minimum?: number
  maximum?: number
  maximumFormula?: FormulaExpression
  initialValue?: number
  initialFormula?: FormulaExpression
  allowTemporaryValue?: boolean
  allowManualAdjustment?: boolean
  editPermission?: CustomSystemEditPermission
  recoveryRules?: CustomResourceRecoveryRule[]
  visibility?: CustomCondition
}

export type CustomResourceType = 'number' | 'checkboxes' | 'dicePool' | 'charges'

export interface CustomResourceRecoveryRule {
  event: CustomSystemEventType
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
  conditions?: CustomCondition[]
}

export interface CustomResourceCostDefinition {
  resourceId: string
  amount?: number
  formula?: FormulaExpression
}