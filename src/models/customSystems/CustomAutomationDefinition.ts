import type { FormulaExpression, JsonValue } from "./CustomGenerals"

export interface CustomAutomationDefinition {
  id: string
  name: string
  event: CustomSystemEventType
  conditions?: CustomCondition[]
  effects: CustomEffectDefinition[]
  enabled?: boolean
  /**
   * Optional repeatable-record scope. When present, this automation runs once
   * for every matching collection entry instead of once for the character.
   */
  collectionScope?: CustomCollectionAutomationScope
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
  | 'collectionEntryCompleted'
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


export interface CustomCollectionAutomationScope {
  collectionId: string
  conditions?: CustomCollectionCondition[]
  roll?: {
    formula: FormulaExpression
    dc?: number
    dcFormula?: FormulaExpression
    progressFieldId: string
    progressOnCriticalFailure?: number
    progressOnFailure?: number
    progressOnSuccess?: number
    progressOnCriticalSuccess?: number
  }
  completion?: {
    progressFieldId: string
    targetFieldId: string
    /** Reference field containing the item produced by this entry. */
    outputReferenceFieldId?: string
    /** Item reference on the entry that owns structured data used by completion. */
    relatedItemReferenceFieldId?: string
    /** Field in related item's custom-system data containing the produced item reference. */
    outputFromRelatedItemFieldId?: string
    /** Quantity-reference or grouped field in related item's custom-system data. */
    ingredientGroupFieldId?: string
    /** Reference to another collection entry (legacy/general relational workflow). */
    relatedEntryReferenceFieldId?: string
    /**
     * On the related entry, a multiple reference field containing ingredient
     * records. Each ingredient record can point at an item and define quantity.
     */
    ingredientReferencesFieldId?: string
    ingredientItemFieldId?: string
    ingredientQuantityFieldId?: string
    deactivateFieldId?: string
    notify?: boolean
    emitEvent?: boolean
  }
}

export interface CustomCollectionCondition {
  fieldId: string
  operator: CustomComparisonOperator
  value?: JsonValue
}
