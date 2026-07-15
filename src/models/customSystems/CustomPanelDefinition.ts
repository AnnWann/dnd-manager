import type { CustomCondition } from "./CustomAutomationDefinition"
import type { FormulaExpression, JsonValue } from "./CustomGenerals"

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