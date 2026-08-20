import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CustomAutomationDefinition,
  CustomComparisonOperator,
  CustomEffectDefinition,
  CustomOperand,
  CustomSystemEventType,
} from "../../models/customSystems/CustomAutomationDefinition"
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { getCharacterFormulaValues } from "./CharacterFormulaVariables"
import { evaluateCustomFormula } from "./CustomFormulaEngineWithCharacter"
import {
  setCustomFieldValue,
  setCustomResourceState,
} from "./CustomSystemState"

export type AppliedCustomAutomation = {
  systemId: string
  automationId: string
  automationName: string
}

export type CustomAutomationRunResult = {
  character: CharacterTemplate
  applied: AppliedCustomAutomation[]
}

export function runCustomSystemAutomations(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  event: CustomSystemEventType,
): CustomAutomationRunResult {
  let nextCharacter = character
  const applied: AppliedCustomAutomation[] = []

  for (const definition of definitions) {
    const state = findEnabledState(nextCharacter, definition.id)
    if (!state) continue

    for (const automation of definition.automations ?? []) {
      if (automation.enabled === false || automation.event !== event) continue
      const result = runAutomation(nextCharacter, definition, automation)
      nextCharacter = result.character
      if (result.applied) {
        applied.push({
          systemId: definition.id,
          automationId: automation.id,
          automationName: automation.name,
        })
      }
    }
  }

  return { character: nextCharacter, applied }
}

export function runCustomSystemAutomation(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  systemId: string,
  automationId: string,
): CustomAutomationRunResult {
  const definition = definitions.find((entry) => entry.id === systemId)
  if (!definition) throw new Error(`Custom system “${systemId}” was not found.`)
  const automation = (definition.automations ?? []).find(
    (entry) => entry.id === automationId,
  )
  if (!automation) throw new Error(`Automation “${automationId}” was not found.`)
  if (automation.enabled === false) throw new Error("This automation is disabled.")
  if (automation.event !== "manual") {
    throw new Error("Only manual automations can be executed directly.")
  }

  const result = runAutomation(character, definition, automation)
  return {
    character: result.character,
    applied: result.applied
      ? [{
          systemId,
          automationId,
          automationName: automation.name,
        }]
      : [],
  }
}

function runAutomation(
  character: CharacterTemplate,
  definition: CustomSystemDefinition,
  automation: CustomAutomationDefinition,
): { character: CharacterTemplate; applied: boolean } {
  const state = findEnabledState(character, definition.id)
  if (!state) return { character, applied: false }
  if (!conditionsPass(automation, definition, state, character)) {
    return { character, applied: false }
  }

  const nextState = applyEffects(
    automation,
    definition,
    state,
    character,
  )
  if (JSON.stringify(nextState) === JSON.stringify(state)) {
    return { character, applied: false }
  }

  return {
    character: replaceState(character, nextState),
    applied: true,
  }
}

function conditionsPass(
  automation: CustomAutomationDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): boolean {
  return (automation.conditions ?? []).every((condition) => {
    const left = resolveOperand(condition.left, definition, state, character)
    const right = condition.right
      ? resolveOperand(condition.right, definition, state, character)
      : undefined
    return compare(left, condition.operator, right)
  })
}

function applyEffects(
  automation: CustomAutomationDefinition,
  definition: CustomSystemDefinition,
  initial: CharacterCustomSystemState,
  character: CharacterTemplate,
): CharacterCustomSystemState {
  let state = initial

  for (const effect of automation.effects ?? []) {
    state = applyEffect(effect, definition, state, character)
  }

  return state
}

function applyEffect(
  effect: CustomEffectDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): CharacterCustomSystemState {
  if (effect.type === "modifyResource") {
    const resource = definition.resources.find((entry) => entry.id === effect.resourceId)
    const current = state.resources[effect.resourceId]
    if (!resource || !current) return state

    const operand = numericEffectValue(effect, definition, state, character)
    const maximum = current.maximum ?? resource.maximum
    const nextCurrent = effect.operation === "resetToMaximum"
      ? maximum ?? current.current
      : applyNumeric(current.current, effect.operation, operand)

    return setCustomResourceState(
      definition,
      state,
      effect.resourceId,
      {
        ...current,
        current: nextCurrent,
      },
      "automation",
    )
  }

  if (effect.type === "setField") {
    const value = effect.formula?.trim()
      ? formulaValue(effect.formula, definition, state, character)
      : effect.value
    if (value === undefined) return state
    return setCustomFieldValue(
      definition,
      state,
      effect.fieldId,
      value,
      "automation",
    )
  }

  const current = state.fields[effect.fieldId]
  if (typeof current !== "number") return state
  const operand = numericEffectValue(effect, definition, state, character)
  const nextValue = effect.operation === "resetToMaximum"
    ? current
    : applyNumeric(current, effect.operation, operand)

  return setCustomFieldValue(
    definition,
    state,
    effect.fieldId,
    nextValue,
    "automation",
  )
}

function numericEffectValue(
  effect: Extract<CustomEffectDefinition, { type: "modifyResource" | "modifyField" }>,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): number {
  if (effect.formula?.trim()) {
    const value = formulaValue(effect.formula, definition, state, character)
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Automation formula must return a finite number.")
    }
    return value
  }
  return Number.isFinite(effect.value) ? effect.value ?? 0 : 0
}

function formulaValue(
  formula: string,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
) {
  const result = evaluateCustomFormula(formula, definition, state, character)
  if (!result.ok) {
    throw new Error(result.error || "Automation formula could not be evaluated.")
  }
  return result.value
}

function resolveOperand(
  operand: CustomOperand,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
) {
  if (operand.type === "literal") return operand.value
  if (operand.type === "field") return state.fields[operand.fieldId]
  if (operand.type === "resource") {
    const resource = state.resources[operand.resourceId]
    if (!resource) return undefined
    return resource[operand.property ?? "current"]
  }
  if (operand.type === "characterPath") {
    return getCharacterFormulaValues(character)[operand.path]
  }
  return formulaValue(operand.formula, definition, state, character)
}

function compare(
  left: unknown,
  operator: CustomComparisonOperator,
  right: unknown,
): boolean {
  if (operator === "isTruthy") return Boolean(left)
  if (operator === "isFalsy") return !left
  if (operator === "equals") return JSON.stringify(left) === JSON.stringify(right)
  if (operator === "notEquals") return JSON.stringify(left) !== JSON.stringify(right)

  if (operator === "contains" || operator === "notContains") {
    const contains = Array.isArray(left)
      ? left.some((entry) => JSON.stringify(entry) === JSON.stringify(right))
      : typeof left === "string"
        ? left.includes(String(right ?? ""))
        : false
    return operator === "contains" ? contains : !contains
  }

  if (typeof left !== "number" || typeof right !== "number") return false
  if (operator === "greaterThan") return left > right
  if (operator === "greaterThanOrEqual") return left >= right
  if (operator === "lessThan") return left < right
  if (operator === "lessThanOrEqual") return left <= right
  return false
}

function applyNumeric(
  current: number,
  operation: "set" | "add" | "subtract" | "multiply",
  value: number,
): number {
  if (operation === "set") return value
  if (operation === "add") return current + value
  if (operation === "subtract") return current - value
  return current * value
}

function findEnabledState(
  character: CharacterTemplate,
  systemId: string,
): CharacterCustomSystemState | undefined {
  return (character.get("sheet").customSystems ?? []).find(
    (state) => state.systemId === systemId && state.enabled !== false,
  )
}

function replaceState(
  character: CharacterTemplate,
  nextState: CharacterCustomSystemState,
): CharacterTemplate {
  const states = character.get("sheet").customSystems ?? []
  return character.withSheet(
    "customSystems",
    states.map((state) =>
      state.systemId === nextState.systemId ? nextState : state,
    ),
  )
}
