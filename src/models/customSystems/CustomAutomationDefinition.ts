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

/**
 * `systemId` is optional for backwards compatibility. When omitted, field and
 * resource operands refer to the system that owns the automation.
 */
export type CustomOperand =
  | { type: 'literal'; value: JsonValue }
  | { type: 'field'; fieldId: string; systemId?: string }
  | { type: 'resource'; resourceId: string; property?: 'current' | 'maximum' | 'temporary'; systemId?: string }
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

/**
 * `systemId` follows the same compatibility rule as operands: undefined means
 * the system that owns the automation. Supplying it allows an automation to
 * update a resource or field from another installed custom system.
 */
export interface CustomModifyResourceEffect {
  type: 'modifyResource'
  systemId?: string
  resourceId: string
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
}

export interface CustomSetFieldEffect {
  type: 'setField'
  systemId?: string
  fieldId: string
  value?: JsonValue
  formula?: FormulaExpression
}

export interface CustomModifyFieldEffect {
  type: 'modifyField'
  systemId?: string
  fieldId: string
  operation: CustomNumericOperation
  value?: number
  formula?: FormulaExpression
}

export type CustomNumericOperation = 'set' | 'add' | 'subtract' | 'multiply' | 'resetToMaximum'
