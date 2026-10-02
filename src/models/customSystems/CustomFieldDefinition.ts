import type { CustomCondition } from "./CustomAutomationDefinition"
import type { Attribute } from "../sheet/Attribute"
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
  | 'attribute'
  | 'richText'
  | 'reference'
  | 'collectionGroup'
  | 'quantityReference'
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

export interface CustomAttributeFieldDefinition extends CustomFieldBase {
  type: 'attribute'
  /** Restrict which character attributes may be selected. Defaults to all six. */
  allowedAttributes?: Attribute[]
}

export type CustomReferenceSource =
  | { type: CustomReferenceTarget }
  | { type: 'inventoryItem'; scope?: 'character' | 'party' | 'ground' | 'any' }
  | { type: 'compendiumItem' }
  | { type: 'itemType'; systemId?: string; itemTypeId: string }
  | { type: 'collection'; systemId?: string; collectionId: string }

export interface CustomReferenceFieldDefinition extends CustomFieldBase {
  type: 'reference'
  /** Legacy single target. Kept for backwards compatibility. */
  target?: CustomReferenceTarget
  /** Allowed reference sources. Multiple sources can be combined in one picker. */
  targets?: CustomReferenceSource[]
  multiple?: boolean
}

export interface CustomCollectionGroupFieldDefinition extends CustomFieldBase {
  type: 'collectionGroup'
  fields: CustomFieldDefinition[]
  minimumEntries?: number
  maximumEntries?: number
}

export interface CustomQuantityReferenceFieldDefinition extends CustomFieldBase {
  type: 'quantityReference'
  targets: CustomReferenceSource[]
  minimumQuantity?: number
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
  | CustomAttributeFieldDefinition
  | CustomReferenceFieldDefinition
  | CustomCollectionGroupFieldDefinition
  | CustomQuantityReferenceFieldDefinition
  | CustomFormulaFieldDefinition