import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type { CustomAbilityTypeDefinition } from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import type { JsonValue } from '../../models/customSystems/CustomGenerals'
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

export type CustomAbilityFormulaContext = {
  type: CustomAbilityTypeDefinition
  values?: Record<string, JsonValue>
  /** Resultado de uma rolagem resolvida para esta ativação. */
  rollValue?: number
}

type SystemGroupedFormulaVariable = CustomFormulaVariable & {
  customSystemId?: string
  customSystemName?: string
}

export function listCustomFormulaVariables(
  definition: CustomSystemDefinition,
  abilityType?: CustomAbilityTypeDefinition,
): CustomFormulaVariable[] {
  const calculatedFieldVariables: CustomFormulaVariable[] = definition.fields
    .filter((field) => field.type === 'formula')
    .map((field) => ({
      path: `field.${field.id}`,
      label: `${field.name} — calculado`,
      valueType: field.resultType,
    }))

  const abilityVariables: CustomFormulaVariable[] = (abilityType?.fields ?? [])
    .filter(isFormulaCompatibleAbilityField)
    .map((field) => ({
      path: `ability.${field.id}`,
      label: `${field.name} — habilidade`,
      valueType: formulaValueType(field),
    }))

  const rollVariables: CustomFormulaVariable[] = abilityType?.activation?.roll
    ? [{ path: 'roll.value', label: 'Resultado da rolagem', valueType: 'number' }]
    : []

  const variables: SystemGroupedFormulaVariable[] = [
    ...listCharacterFormulaVariables(),
    ...listBaseFormulaVariables(definition).map((variable) => ({
      ...variable,
      customSystemId: definition.id,
      customSystemName: definition.name,
    })),
    ...calculatedFieldVariables.map((variable) => ({
      ...variable,
      customSystemId: definition.id,
      customSystemName: definition.name,
    })),
    ...abilityVariables.map((variable) => ({
      ...variable,
      customSystemId: definition.id,
      customSystemName: definition.name,
    })),
    ...rollVariables.map((variable) => ({
      ...variable,
      customSystemId: definition.id,
      customSystemName: definition.name,
    })),
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
  ability?: CustomAbilityFormulaContext,
): CustomFormulaResult {
  const transformed = transformFormulaContext(
    formula,
    definition,
    state,
    getCharacterFormulaValues(character),
    ability,
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
  abilityType?: CustomAbilityTypeDefinition,
): string | undefined {
  const transformed = transformFormulaContext(
    formula,
    definition,
    createMockState(definition),
    getCharacterFormulaValues(),
    abilityType ? { type: abilityType } : undefined,
  )

  return validateBaseFormula(transformed.formula, transformed.definition)
}

function transformFormulaContext(
  formula: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  characterValues: Record<string, number | boolean | string>,
  ability?: CustomAbilityFormulaContext,
): {
  formula: string
  definition: CustomSystemDefinition
  state: CharacterCustomSystemState
} {
  const characterReplacements = Object.keys(characterValues).map((path) => ({
    path,
    fieldId: toVirtualFieldId('__character', path),
  }))

  const abilityFields = (ability?.type.fields ?? []).filter(isFormulaCompatibleAbilityField)
  const abilityReplacements = abilityFields.map((field) => ({
    path: `ability.${field.id}`,
    fieldId: toVirtualFieldId('__ability', field.id),
    field,
  }))

  const rollReplacement = ability?.type.activation?.roll
    ? { path: 'roll.value', fieldId: toVirtualFieldId('__roll', 'value') }
    : undefined

  const replacements = [
    ...characterReplacements,
    ...abilityReplacements,
    ...(rollReplacement ? [rollReplacement] : []),
  ].sort((left, right) => right.path.length - left.path.length)

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

  const characterVirtualFields: CustomFieldDefinition[] = characterReplacements.map(({ path, fieldId }) => ({
    id: fieldId,
    name: path,
    type: typeof characterValues[path] === 'boolean' ? 'boolean' :
      typeof characterValues[path] === 'number' ? 'number' : 'text',
    editPermission: 'automaticOnly',
  }))

  const abilityVirtualFields: CustomFieldDefinition[] = abilityReplacements.map(({ path, fieldId, field }) => {
    if (field.type === 'formula') {
      return {
        id: fieldId,
        name: path,
        type: 'formula',
        formula: translate(field.formula) ?? '',
        resultType: field.resultType,
        editPermission: 'automaticOnly',
      }
    }

    const valueType = formulaValueType(field)
    return {
      id: fieldId,
      name: path,
      type: valueType === 'number'
        ? 'number'
        : valueType === 'boolean'
          ? 'boolean'
          : valueType === 'dice'
            ? 'dice'
            : 'text',
      editPermission: 'automaticOnly',
    }
  })

  const rollVirtualFields: CustomFieldDefinition[] = rollReplacement
    ? [{
        id: rollReplacement.fieldId,
        name: 'roll.value',
        type: 'number',
        editPermission: 'automaticOnly',
      }]
    : []

  const abilityStateValues = Object.fromEntries(
    abilityReplacements
      .filter(({ field }) => field.type !== 'formula')
      .map(({ fieldId, field }) => [
        fieldId,
        normalizeAbilityFormulaValue(
          ability?.values?.[field.id] ?? field.defaultValue,
          formulaValueType(field),
        ),
      ]),
  )

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
        ...characterVirtualFields,
        ...abilityVirtualFields,
        ...rollVirtualFields,
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
          characterReplacements.map(({ path, fieldId }) => [fieldId, characterValues[path]]),
        ),
        ...abilityStateValues,
        ...(rollReplacement ? { [rollReplacement.fieldId]: ability?.rollValue ?? 0 } : {}),
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
          field.defaultValue ?? (
            field.type === 'boolean'
              ? false
              : field.type === 'number'
                ? 0
                : field.type === 'dice'
                  ? field.allowedDice?.[0] ?? 'd6'
                  : ''
          ),
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

function isFormulaCompatibleAbilityField(field: CustomFieldDefinition): boolean {
  return field.type !== 'multiSelect' && field.type !== 'reference'
}

function formulaValueType(field: CustomFieldDefinition): 'number' | 'text' | 'boolean' | 'dice' {
  if (field.type === 'formula') return field.resultType
  if (field.type === 'number') return 'number'
  if (field.type === 'boolean') return 'boolean'
  if (field.type === 'dice') return 'dice'
  return 'text'
}

function normalizeAbilityFormulaValue(
  value: JsonValue | undefined,
  valueType: 'number' | 'text' | 'boolean' | 'dice',
): number | string | boolean {
  if (valueType === 'number') return typeof value === 'number' && Number.isFinite(value) ? value : 0
  if (valueType === 'boolean') return typeof value === 'boolean' ? value : false
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return valueType === 'dice' ? 'd6' : ''
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

function toVirtualFieldId(prefix: string, path: string): string {
  return `${prefix}_${path.replace(/[^A-Za-z0-9_-]/g, '_')}`
}