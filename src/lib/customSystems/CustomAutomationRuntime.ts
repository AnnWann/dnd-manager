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
import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type { Itemmable } from "../../models/items/item"
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
  collectionId?: string
  entryId?: string
  roll?: number
  completedItemName?: string
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
      if (automation.collectionScope) {
        const result = runCollectionAutomation(nextCharacter, definition, automation)
        nextCharacter = result.character
        applied.push(...result.applied.map((entry) => ({
          systemId: definition.id,
          automationId: automation.id,
          automationName: automation.name,
          ...entry,
        })))
        continue
      }
      const result = runAutomation(nextCharacter, definitions, definition, automation)
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

function runCollectionAutomation(
  character: CharacterTemplate,
  definition: CustomSystemDefinition,
  automation: CustomAutomationDefinition,
): { character: CharacterTemplate; applied: Array<{collectionId:string;entryId:string;roll?:number;completedItemName?:string}> } {
  const scope = automation.collectionScope
  if (!scope) return { character, applied: [] }
  let nextCharacter = character
  const applied: Array<{collectionId:string;entryId:string;roll?:number;completedItemName?:string}> = []
  const initialState = findEnabledState(nextCharacter, definition.id)
  const entries = initialState?.collections?.[scope.collectionId] ?? []

  for (const originalEntry of entries) {
    let state = findEnabledState(nextCharacter, definition.id)
    if (!state) break
    const entry = state.collections?.[scope.collectionId]?.find((candidate) => candidate.id === originalEntry.id)
    if (!entry || !(scope.conditions ?? []).every((condition) => compare(entry.values[condition.fieldId], condition.operator, condition.value))) continue

    let roll: number | undefined
    if (scope.roll) {
      const d20 = Math.floor(Math.random() * 20) + 1
      const bonus = evaluateEntryNumber(scope.roll.formula, entry.values)
      const dc = scope.roll.dcFormula?.trim()
        ? evaluateEntryNumber(scope.roll.dcFormula, entry.values)
        : scope.roll.dc ?? 10
      roll = d20 + bonus
      const delta = d20 === 1
        ? scope.roll.progressOnCriticalFailure ?? 0
        : d20 === 20
          ? scope.roll.progressOnCriticalSuccess ?? 0
          : roll >= dc
            ? scope.roll.progressOnSuccess ?? 0
            : scope.roll.progressOnFailure ?? 0
      const current = Number(entry.values[scope.roll.progressFieldId]) || 0
      nextCharacter = updateCollectionEntry(nextCharacter, definition.id, scope.collectionId, entry.id, scope.roll.progressFieldId, Math.max(0, current + delta))
    }

    let completedItemName: string | undefined
    state = findEnabledState(nextCharacter, definition.id)
    const currentEntry = state?.collections?.[scope.collectionId]?.find((candidate) => candidate.id === originalEntry.id)
    const completion = scope.completion
    if (currentEntry && completion) {
      const progress = Number(currentEntry.values[completion.progressFieldId]) || 0
      const target = Number(currentEntry.values[completion.targetFieldId]) || 0
      if (target > 0 && progress >= target) {
        const output = completion.outputReferenceFieldId ? currentEntry.values[completion.outputReferenceFieldId] : undefined
        const outputItem = referencedItemSnapshot(output)
        if (outputItem) {
          const item = { ...outputItem, id: crypto.randomUUID(), quantity: Math.max(1, Number(outputItem.quantity) || 1) } as Itemmable
          nextCharacter = nextCharacter.addInventoryItem(item)
          completedItemName = item.name
        }
        if (completion.relatedEntryReferenceFieldId) {
          nextCharacter = consumeRelatedIngredients(nextCharacter, definition, currentEntry.values[completion.relatedEntryReferenceFieldId], completion)
        }
        if (completion.deactivateFieldId) {
          nextCharacter = updateCollectionEntry(nextCharacter, definition.id, scope.collectionId, currentEntry.id, completion.deactivateFieldId, false)
        }
      }
    }
    applied.push({ collectionId: scope.collectionId, entryId: originalEntry.id, ...(roll === undefined ? {} : { roll }), ...(completedItemName ? { completedItemName } : {}) })
  }
  return { character: nextCharacter, applied }
}

function evaluateEntryNumber(formula: string, values: Record<string, JsonValue>): number {
  const replaced = formula.replace(/entry\.([a-zA-Z0-9_-]+)/g, (_, key: string) => String(Number(values[key]) || 0))
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) return Number(formula) || 0
  try {
    const value = Function(`"use strict"; return (\${replaced})`)()
    return Number.isFinite(value) ? Number(value) : 0
  } catch { return 0 }
}

function updateCollectionEntry(character: CharacterTemplate, systemId: string, collectionId: string, entryId: string, fieldId: string, value: JsonValue): CharacterTemplate {
  const state = findEnabledState(character, systemId)
  if (!state) return character
  const entries = state.collections?.[collectionId] ?? []
  const nextState = { ...state, collections: { ...(state.collections ?? {}), [collectionId]: entries.map((entry) => entry.id === entryId ? { ...entry, values: { ...entry.values, [fieldId]: value }, updatedAt: new Date().toISOString() } : entry) } }
  return replaceState(character, nextState)
}

function asReference(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, JsonValue> : undefined
}
function referencedItemSnapshot(value: JsonValue | undefined): Record<string, unknown> | undefined {
  const ref = asReference(value)
  const item = ref?.item
  return item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : undefined
}
function collectionEntryFromReference(definition: CustomSystemDefinition, state: CharacterCustomSystemState, value: JsonValue | undefined) {
  const ref = asReference(value)
  if (ref?.type !== "collectionEntry" || typeof ref.collectionId !== "string" || typeof ref.entryId !== "string") return undefined
  return state.collections?.[ref.collectionId]?.find((entry) => entry.id === ref.entryId)
}
function consumeRelatedIngredients(character: CharacterTemplate, definition: CustomSystemDefinition, relatedRef: JsonValue | undefined, completion: NonNullable<NonNullable<CustomAutomationDefinition["collectionScope"]>["completion"]>): CharacterTemplate {
  const state = findEnabledState(character, definition.id)
  if (!state || !completion.ingredientReferencesFieldId || !completion.ingredientItemFieldId || !completion.ingredientQuantityFieldId) return character
  const related = collectionEntryFromReference(definition, state, relatedRef)
  const ingredientRefs = related?.values[completion.ingredientReferencesFieldId]
  if (!Array.isArray(ingredientRefs)) return character
  let inventory = [...character.get("inventory")]
  for (const ingredientRef of ingredientRefs) {
    const ingredient = collectionEntryFromReference(definition, state, ingredientRef)
    if (!ingredient) continue
    const itemRef = asReference(ingredient.values[completion.ingredientItemFieldId])
    const needed = Math.max(0, Math.trunc(Number(ingredient.values[completion.ingredientQuantityFieldId]) || 0))
    if (!itemRef || needed <= 0) continue
    const sourceId = typeof itemRef.itemId === "string" ? itemRef.itemId : ""
    const sourceName = typeof itemRef.name === "string" ? itemRef.name : ""
    let remaining = needed
    inventory = inventory.flatMap((item) => {
      if (remaining <= 0) return [item]
      const matches = (sourceId && (item.id === sourceId || item.compendiumItemId === sourceId)) || (sourceName && item.name === sourceName)
      if (!matches) return [item]
      const available = Math.max(0, Math.trunc(Number(item.quantity) || 0))
      const used = Math.min(available, remaining)
      remaining -= used
      return available - used > 0 ? [{ ...item, quantity: available - used } as Itemmable] : []
    })
  }
  return character.with("inventory", inventory)
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

  const result = runAutomation(character, definitions, definition, automation)
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
  definitions: CustomSystemDefinition[],
  definition: CustomSystemDefinition,
  automation: CustomAutomationDefinition,
): { character: CharacterTemplate; applied: boolean } {
  const state = findEnabledState(character, definition.id)
  if (!state) return { character, applied: false }
  if (!conditionsPass(automation, definition, state, character)) {
    return { character, applied: false }
  }

  const nextCharacter = applyEffects(
    automation,
    definitions,
    definition,
    character,
  )
  if (customSystemsEqual(nextCharacter, character)) {
    return { character, applied: false }
  }

  return {
    character: nextCharacter,
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
  definitions: CustomSystemDefinition[],
  sourceDefinition: CustomSystemDefinition,
  character: CharacterTemplate,
): CharacterTemplate {
  let nextCharacter = character

  for (const effect of automation.effects ?? []) {
    nextCharacter = applyEffect(
      effect,
      definitions,
      sourceDefinition,
      nextCharacter,
    )
  }

  return nextCharacter
}

function applyEffect(
  effect: CustomEffectDefinition,
  definitions: CustomSystemDefinition[],
  sourceDefinition: CustomSystemDefinition,
  character: CharacterTemplate,
): CharacterTemplate {
  const sourceState = findEnabledState(character, sourceDefinition.id)
  if (!sourceState) return character

  const targetSystemId = effect.systemId ?? sourceDefinition.id
  const targetDefinition = definitions.find((entry) => entry.id === targetSystemId)
  const targetState = findEnabledState(character, targetSystemId)
  if (!targetDefinition || !targetState) return character

  if (effect.type === "modifyResource") {
    const resource = targetDefinition.resources.find((entry) => entry.id === effect.resourceId)
    const current = targetState.resources[effect.resourceId]
    if (!resource || !current) return character

    const operand = numericEffectValue(
      effect,
      sourceDefinition,
      sourceState,
      character,
    )
    const maximum = current.maximum ?? resource.maximum
    const nextCurrent = effect.operation === "resetToMaximum"
      ? maximum ?? current.current
      : applyNumeric(current.current, effect.operation, operand)

    return replaceState(
      character,
      setCustomResourceState(
        targetDefinition,
        targetState,
        effect.resourceId,
        {
          ...current,
          current: nextCurrent,
        },
        "automation",
      ),
    )
  }

  if (effect.type === "setField") {
    const value = effect.formula?.trim()
      ? formulaValue(effect.formula, sourceDefinition, sourceState, character)
      : effect.value
    if (value === undefined) return character
    return replaceState(
      character,
      setCustomFieldValue(
        targetDefinition,
        targetState,
        effect.fieldId,
        value,
        "automation",
      ),
    )
  }

  const current = targetState.fields[effect.fieldId]
  if (typeof current !== "number") return character
  const operand = numericEffectValue(
    effect,
    sourceDefinition,
    sourceState,
    character,
  )
  const nextValue = effect.operation === "resetToMaximum"
    ? current
    : applyNumeric(current, effect.operation, operand)

  return replaceState(
    character,
    setCustomFieldValue(
      targetDefinition,
      targetState,
      effect.fieldId,
      nextValue,
      "automation",
    ),
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
  if (operand.type === "field") {
    const targetState = operand.systemId
      ? findState(character, operand.systemId)
      : state
    return targetState?.fields[operand.fieldId]
  }
  if (operand.type === "resource") {
    const targetState = operand.systemId
      ? findState(character, operand.systemId)
      : state
    const resource = targetState?.resources[operand.resourceId]
    if (!resource) return undefined
    return resource[operand.property ?? "current"]
  }
  if (operand.type === "characterPath") {
    return getCharacterFormulaValues(character, [operand.path])[operand.path]
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
  return findState(character, systemId, true)
}

function findState(
  character: CharacterTemplate,
  systemId: string,
  enabledOnly = false,
): CharacterCustomSystemState | undefined {
  return (character.get("sheet").customSystems ?? []).find(
    (state) =>
      state.systemId === systemId &&
      (!enabledOnly || state.enabled !== false),
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

function customSystemsEqual(
  left: CharacterTemplate,
  right: CharacterTemplate,
): boolean {
  return JSON.stringify(left.get("sheet").customSystems ?? []) ===
    JSON.stringify(right.get("sheet").customSystems ?? [])
}
