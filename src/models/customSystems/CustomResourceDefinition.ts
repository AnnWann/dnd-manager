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
  /**
   * fixed: usa maximum; formula: sempre recalculado; manual: salvo por personagem;
   * formulaWithOverride: usa a fórmula inicialmente, mas aceita ajuste por personagem.
   */
  maximumMode?: CustomResourceMaximumMode
  maximumEditPermission?: CustomSystemEditPermission
  initialValue?: number
  initialFormula?: FormulaExpression
  allowTemporaryValue?: boolean
  allowManualAdjustment?: boolean
  editPermission?: CustomSystemEditPermission
  recoveryRules?: CustomResourceRecoveryRule[]
  visibility?: CustomCondition
}

export type CustomResourceType = 'number' | 'checkboxes' | 'dicePool' | 'charges'

export type CustomResourceMaximumMode = 'fixed' | 'formula' | 'manual' | 'formulaWithOverride'

export interface CustomResourceRecoveryRule {
  id?: string
  enabled?: boolean
  event: CustomSystemEventType
  target?: 'current' | 'temporary'
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
  /** Em descansos parciais, aplica proporcionalmente adições/subtrações e recuperação do valor ausente. */
  scaleWithRestFraction?: boolean
  conditions?: CustomCondition[]
}

export interface CustomResourceCostDefinition {
  resourceId: string
  amount?: number
  formula?: FormulaExpression
}
