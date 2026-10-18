import type { AbilityActionKind, AbilityKind, Trigger } from "../abilities/Ability"

export type CustomSystemId = string
export type CustomSystemVersion = number
export type FormulaExpression = string

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type CustomSystemEditPermission =
  | 'masterOnly'
  | 'owner'
  | 'ownerAndMaster'
  | 'automaticOnly'

export interface CustomSystemDefinition {
  id: CustomSystemId
  name: string
  description?: string
  icon?: string
  version: CustomSystemVersion
  fields: CustomFieldDefinition[]
  resources: CustomResourceDefinition[]
  abilityTypes: CustomAbilityTypeDefinition[]
  panels: CustomPanelDefinition[]
  automations: CustomAutomationDefinition[]
  tags?: string[]
}

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
  resultType: 'number' | 'text' | 'boolean'
  editPermission?: 'automaticOnly'
}

export type CustomFieldDefinition =
  | CustomNumberFieldDefinition
  | CustomTextFieldDefinition
  | CustomBooleanFieldDefinition
  | CustomSelectFieldDefinition
  | CustomDiceFieldDefinition
  | CustomReferenceFieldDefinition
  | CustomFormulaFieldDefinition

export type CustomDie = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'

export type CustomReferenceTarget =
  | 'ability'
  | 'character'
  | 'class'
  | 'item'
  | 'magic'
  | 'resource'
  | 'systemAbility'

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

export interface CustomPanelDefinition {
  id: string
  name: string
  location: CustomPanelLocation
  blocks: CustomPanelBlock[]
  visibility?: CustomCondition
}

export type CustomPanelLocation =
  | 'main'
  | 'sidebar'
  | 'combat'
  | 'abilities'
  | 'resources'
  | 'customTab'

export interface CustomPanelBlockBase {
  id: string
  title?: string
  visibility?: CustomCondition
}

export interface CustomResourceBlock extends CustomPanelBlockBase {
  type: 'resource'
  resourceId: string
  display: 'number' | 'bar' | 'checkboxes' | 'dicePool'
}

export interface CustomFieldBlock extends CustomPanelBlockBase {
  type: 'field'
  fieldId: string
}

export interface CustomAbilityListBlock extends CustomPanelBlockBase {
  type: 'abilityList'
  abilityTypeId: string
  layout?: 'list' | 'cards' | 'compact'
  filters?: Record<string, JsonValue>
}

export interface CustomTextBlock extends CustomPanelBlockBase {
  type: 'text'
  content: string
}

export interface CustomDividerBlock extends CustomPanelBlockBase {
  type: 'divider'
}

export interface CustomFormulaDisplayBlock extends CustomPanelBlockBase {
  type: 'formulaDisplay'
  formula: FormulaExpression
  label?: string
}

export interface CustomGridBlock extends CustomPanelBlockBase {
  type: 'grid'
  columns: 1 | 2 | 3 | 4
  blocks: CustomPanelBlock[]
}

export type CustomPanelBlock =
  | CustomResourceBlock
  | CustomFieldBlock
  | CustomAbilityListBlock
  | CustomTextBlock
  | CustomDividerBlock
  | CustomFormulaDisplayBlock
  | CustomGridBlock

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

export interface CharacterCustomSystemState {
  systemId: CustomSystemId
  systemVersion: CustomSystemVersion
  enabled: boolean
  fields: Record<string, JsonValue>
  resources: Record<string, CustomResourceState>
  abilities: CustomAbilityInstance[]
}

export interface CustomResourceState {
  current: number
  maximum?: number
  temporary?: number
}

export interface CustomAbilityInstance {
  id: string
  abilityTypeId: string
  values: Record<string, JsonValue>
  usage?: CustomAbilityUsageState
  enabled?: boolean
}

export interface CustomAbilityUsageState {
  used: number
  maximum?: number
}

export interface CustomSystemAssignment {
  systemId: CustomSystemId
  target: CustomSystemAssignmentTarget
}

export type CustomSystemAssignmentTarget =
  | { type: 'campaign' }
  | { type: 'character'; characterId: string }
  | { type: 'template'; templateId: string }
  | { type: 'class'; classId: string }
  | { type: 'tag'; tag: string }

export interface InstalledCustomSystem {
  systemId: CustomSystemId
  installedVersion: CustomSystemVersion
  enabled: boolean
  updateMode: CustomSystemUpdateMode
  configuration?: Record<string, JsonValue>
}

export type CustomSystemUpdateMode = 'automatic' | 'askMaster' | 'lockedVersion'
