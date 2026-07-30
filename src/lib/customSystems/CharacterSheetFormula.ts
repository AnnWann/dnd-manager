import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import {
  evaluateCustomFormula,
  type CustomFormulaResult,
} from './CustomFormulaEngine'
import {
  getCharacterFormulaValues,
  listCharacterFormulaVariables,
  type CharacterFormulaValues,
} from './CharacterFormulaVariables'

let evaluatingCharacterFormula = false

export function evaluateCharacterSheetFormula(
  formula: string,
  character: CharacterTemplate,
): number | undefined {
  if (!formula.trim() || evaluatingCharacterFormula) return undefined

  evaluatingCharacterFormula = true
  try {
    const referencedPaths = listCharacterFormulaVariables()
      .map((variable) => variable.path)
      .filter((path) => containsIdentifier(formula, path))
    const result = evaluateWithValues(
      formula,
      getCharacterFormulaValues(character, referencedPaths),
    )
    return result.ok && typeof result.value === 'number' ? result.value : undefined
  } finally {
    evaluatingCharacterFormula = false
  }
}

export function validateCharacterSheetFormula(
  formula: string,
): string | undefined {
  if (!formula.trim()) return 'Informe uma fórmula.'

  const emptyValues: CharacterFormulaValues = Object.fromEntries(
    listCharacterFormulaVariables().map((variable) => [
      variable.path,
      variable.valueType === 'boolean' ? false : variable.valueType === 'text' ? '' : 0,
    ]),
  )
  const result = evaluateWithValues(formula, emptyValues)
  if (!result.ok) return result.error
  if (typeof result.value !== 'number') return 'A fórmula precisa resultar em um número.'
  return undefined
}

function evaluateWithValues(
  formula: string,
  values: CharacterFormulaValues,
): CustomFormulaResult {
  const replacements = Object.keys(values)
    .sort((left, right) => right.length - left.length)
    .map((variablePath) => ({
      variablePath,
      fieldId: '__sheet_' + variablePath.replace(/[^A-Za-z0-9_-]/g, '_'),
    }))

  const translated = replacements.reduce(
    (current, entry) => replaceIdentifier(
      current,
      entry.variablePath,
      'field.' + entry.fieldId,
    ),
    formula,
  )

  const fields: CustomFieldDefinition[] = replacements.map((entry) => ({
    id: entry.fieldId,
    name: entry.variablePath,
    type: typeof values[entry.variablePath] === 'boolean'
      ? 'boolean'
      : typeof values[entry.variablePath] === 'number'
        ? 'number'
        : 'text',
    editPermission: 'automaticOnly',
  }))

  const definition: CustomSystemDefinition = {
    id: '__sheet_formula__',
    name: 'Fórmula da ficha',
    version: 1,
    fields,
    resources: [],
    abilityTypes: [],
    panels: [],
    automations: [],
  }

  const state: CharacterCustomSystemState = {
    systemId: definition.id,
    systemVersion: definition.version,
    enabled: true,
    fields: Object.fromEntries(
      replacements.map((entry) => [entry.fieldId, values[entry.variablePath]]),
    ),
    resources: {},
    abilities: [],
  }

  return evaluateCustomFormula(translated, definition, state)
}

function replaceIdentifier(
  expression: string,
  identifier: string,
  replacement: string,
): string {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    '(^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])',
    'g',
  )
  return expression.replace(pattern, (_, prefix: string) => prefix + replacement)
}


function containsIdentifier(expression: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\$&')
  return new RegExp(
    '(^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])',
  ).test(expression)
}
