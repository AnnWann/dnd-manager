import type { CustomCondition } from "./CustomAutomationDefinition"
import type { CustomDie, CustomReferenceTarget, CustomSystemEditPermission, FormulaExpression } from "./CustomGenerals"

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type CustomFieldType =
  | 'number'
  | 'text'
  | 'boolean'
  | 'select'
  | 'multiSelect'
  | 'dice'
  | 'richText'
  | 'reference'
  | 'formula'

export interface CustomFieldBase {
  id: string
  name: string
  description?: string
  required?: boolean
  defaultValue?: JsonValue
  editPermission?: CustomSystemEditPermission
  visibility?: CustomCondition
}

export interface CustomNumberFieldDefinition extends CustomFieldBase {
  type: 'number'
  minimum?: number
  maximum?: number
  step?: number
}

export interface CustomTextFieldDefinition extends CustomFieldBase {
  type: 'text' | 'richText'
  minimumLength?: number
  maximumLength?: number
  placeholder?: string
}

export interface CustomBooleanFieldDefinition extends CustomFieldBase {
  type: 'boolean'
}

export interface CustomSelectOption {
  value: string
  label: string
  description?: string
}

export interface CustomSelectFieldDefinition extends CustomFieldBase {
  type: 'select' | 'multiSelect'
  options: CustomSelectOption[]
  minimumSelections?: number
  maximumSelections?: number
  placeholder?: string
}

export interface CustomDiceFieldDefinition extends CustomFieldBase {
  type: 'dice'
  allowedDice?: CustomDie[]
}

export interface CustomReferenceFieldDefinition extends CustomFieldBase {
  type: 'reference'
  target: CustomReferenceTarget
  multiple?: boolean
}

export interface CustomFormulaFieldDefinition extends CustomFieldBase {
  type: 'formula'
  formula: FormulaExpression
  resultType: 'number' | 'text' | 'boolean' | 'dice'
  editPermission?: CustomSystemEditPermission
}

export type CustomFieldDefinition =
  | CustomNumberFieldDefinition
  | CustomTextFieldDefinition
  | CustomBooleanFieldDefinition
  | CustomSelectFieldDefinition
  | CustomDiceFieldDefinition
  | CustomReferenceFieldDefinition
  | CustomFormulaFieldDefinition