import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import {
  evaluateCustomFormula as evaluateBaseFormula,
  listCustomFormulaVariables as listBaseFormulaVariables,
  validateCustomFormula as validateBaseFormula,
  type CustomFormulaResult,
  type CustomFormulaVariable,
} from './CustomFormulaEngine'
import {
  getCharacterFormulaValues,
  listCharacterFormulaVariables,
} from './CharacterFormulaVariables'

export type { CustomFormulaResult, CustomFormulaVariable }

export function listCustomFormulaVariables(
  definition: CustomSystemDefinition,
): CustomFormulaVariable[] {
  const calculatedFieldVariables: CustomFormulaVariable[] = definition.fields
    .filter((field) => field.type === 'formula')
    .map((field) => ({
      path: `field.${field.id}`,
      label: `${field.name} — calculado`,
      valueType: field.resultType,
    }))

  const variables = [
    ...listCharacterFormulaVariables(),
    ...listBaseFormulaVariables(definition),
    ...calculatedFieldVariables,
  ]

  return Array.from(
    new Map(variables.map((variable) => [variable.path, variable])).values(),
  )
}

export function evaluateCustomFormula(
  formula: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character?: CharacterTemplate,
): CustomFormulaResult {
  const transformed = transformFormulaContext(
    formula,
    definition,
    state,
    getCharacterFormulaValues(character),
  )

  return evaluateBaseFormula(
    transformed.formula,
    transformed.definition,
    transformed.state,
  )
}

export function validateCustomFormula(
  formula: string,
  definition: CustomSystemDefinition,
): string | undefined {
  const transformed = transformFormulaContext(
    formula,
    definition,
    createMockState(definition),
    getCharacterFormulaValues(),
  )

  return validateBaseFormula(transformed.formula, transformed.definition)
}

function transformFormulaContext(
  formula: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  characterValues: Record<string, number | boolean | string>,
): {
  formula: string
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
} {
  const replacements = Object.keys(characterValues)
    .sort((left, right) => right.length - left.length)
    .map((path) => ({ path, fieldId: toVirtualFieldId(path) }))

  const translate = (expression: string | undefined): string | undefined => {
    if (!expression) return expression
    return replacements.reduce(
      (current, replacement) => replaceIdentifier(
        current,
        replacement.path,
        `field.${replacement.fieldId}`,
      ),
      expression,
    )
  }

  const virtualFields: CustomFieldDefinition[] = replacements.map(({ path, fieldId }) => ({
    id: fieldId,
    name: path,
    type: typeof characterValues[path] === 'boolean' ? 'boolean' :
      typeof characterValues[path] === 'number' ? 'number' : 'text',
    editPermission: 'automaticOnly',
  }))

  return {
    formula: translate(formula) ?? '',
    definition: {
      ...definition,
      fields: [
        ...definition.fields.map((field) =>
          field.type === 'formula'
            ? { ...field, formula: translate(field.formula) ?? '' }
            : field,
        ),
        ...virtualFields,
      ],
      resources: definition.resources.map((resource) => ({
        ...resource,
        maximumFormula: translate(resource.maximumFormula),
      })),
    },
    state: {
      ...state,
      fields: {
        ...state.fields,
        ...Object.fromEntries(
          replacements.map(({ path, fieldId }) => [fieldId, characterValues[path]]),
        ),
      },
    },
  }
}

function createMockState(
  definition: CustomSystemDefinition,
): CharacterCustomSystemState {
  return {
    systemId: definition.id,
    systemVersion: definition.version,
    enabled: true,
    fields: Object.fromEntries(
      definition.fields
        .filter((field) => field.type !== 'formula')
        .map((field) => [
          field.id,
          field.type === 'boolean' ? false : field.type === 'number' ? 0 : '',
        ]),
    ),
    resources: Object.fromEntries(
      definition.resources.map((resource) => [
        resource.id,
        {
          current: resource.initialValue ?? 0,
          maximum: resource.maximum,
          temporary: 0,
        },
      ]),
    ),
    abilities: [],
  }
}

function replaceIdentifier(
  expression: string,
  identifier: string,
  replacement: string,
): string {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_.-])${escaped}(?=$|[^A-Za-z0-9_.-])`,
    'g',
  )
  return expression.replace(pattern, (_, prefix: string) => `${prefix}${replacement}`)
}

function toVirtualFieldId(path: string): string {
  return `__character_${path.replace(/[^A-Za-z0-9_-]/g, '_')}`
}
