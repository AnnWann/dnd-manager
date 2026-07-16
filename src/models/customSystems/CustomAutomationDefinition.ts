import type { FormulaExpression, JsonValue } from "./CustomGenerals"

export interface CustomAutomationDefinition {
  id: string
  name: string
  event: CustomSystemEventType
  conditions?: CustomCondition[]
  effects: CustomEffectDefinition[]
  enabled?: boolean
}

export type CustomSystemEventType =
  | 'combatStarted'
  | 'combatEnded'
  | 'roundStarted'
  | 'roundEnded'
  | 'turnStarted'
  | 'turnEnded'
  | 'attackHit'
  | 'criticalHit'
  | 'damageTaken'
  | 'healingReceived'
  | 'abilityUsed'
  | 'shortRestCompleted'
  | 'longRestCompleted'
  | 'manual'

export interface CustomCondition {
  left: CustomOperand
  operator: CustomComparisonOperator
  right?: CustomOperand
}

export type CustomOperand =
  | { type: 'literal'; value: JsonValue }
  | { type: 'field'; fieldId: string }
  | { type: 'resource'; resourceId: string; property?: 'current' | 'maximum' | 'temporary' }
  | { type: 'characterPath'; path: string }
  | { type: 'formula'; formula: FormulaExpression }

export type CustomComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'isTruthy'
  | 'isFalsy'

export type CustomEffectDefinition =
  | CustomModifyResourceEffect
  | CustomSetFieldEffect
  | CustomModifyFieldEffect

export interface CustomModifyResourceEffect {
  type: 'modifyResource'
  resourceId: string
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
}

export interface CustomSetFieldEffect {
  type: 'setField'
  fieldId: string
  value?: JsonValue
  formula?: FormulaExpression
}

export interface CustomModifyFieldEffect {
  type: 'modifyField'
  fieldId: string
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
}

export type CustomNumericOperation = 'set' | 'add' | 'subtract' | 'multiply' | 'resetToMaximum'