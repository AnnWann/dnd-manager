import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"
import type { Ability, AbilityManualInput } from "./Ability"

export const MANUAL_INPUT_LIMIT = 12
export const MANUAL_INPUT_BOUND = 100_000
export const MANUAL_INPUT_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

export function validateAbilityInputDefinitions(inputs: AbilityManualInput[] | undefined): string | undefined {
  if (inputs === undefined) return undefined
  if (!Array.isArray(inputs) || inputs.length > MANUAL_INPUT_LIMIT) return "Use no máximo 12 entradas manuais."
  const ids = new Set<string>()
  for (const input of inputs) {
    if (!input || typeof input.id !== "string" || !MANUAL_INPUT_KEY.test(input.id) || ids.has(input.id)) return "Cada entrada precisa de um identificador único, começando com letra e sem espaços."
    ids.add(input.id)
    if (typeof input.label !== "string" || !input.label.trim() || input.label.length > 100) return "Informe o nome de cada entrada (até 100 caracteres)."
    const min = input.min ?? 0
    const max = input.max ?? MANUAL_INPUT_BOUND
    if (![min, max].every(value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MANUAL_INPUT_BOUND) || min > max) return "Limites inválidos nas entradas manuais."
    if (input.defaultValue !== undefined && (typeof input.defaultValue !== "number" || !Number.isFinite(input.defaultValue) || input.defaultValue < min || input.defaultValue > max)) return "O valor inicial precisa estar dentro dos limites."
  }
  return undefined
}

export function validateAbilityInputValues(ability: Pick<Ability, "manualInputs" | "bonuses" | "activationOptions" | "conditionOnUse">, values: Record<string, number> = {}): string | undefined {
  const error = validateAbilityInputDefinitions(ability.manualInputs)
  if (error) return error
  const referenceError = validateAbilityInputReferences(ability)
  if (referenceError) return referenceError
  const definitions = ability.manualInputs ?? []
  if (Object.keys(values).some(id => !definitions.some(input => input.id === id))) return "Entrada manual desconhecida."
  for (const input of definitions) {
    const value = values[input.id]
    if (typeof value !== "number" || !Number.isFinite(value) || value < (input.min ?? 0) || value > (input.max ?? MANUAL_INPUT_BOUND)) return `Informe um valor válido para ${input.label}.`
  }
  return undefined
}

/** Numeric placeholders used only for authoring/validation, never for activation. */
export function abilityInputPreviewValues(inputs: AbilityManualInput[] = []): Record<string, number> {
  return Object.fromEntries(inputs.map(input => [input.id, input.defaultValue ?? input.min ?? 0]))
}

/** Freeze the activation context on formula bonuses, retaining the original formula. */
export function bindAbilityInputValues(ability: Ability, values: Record<string, number> = {}): Ability {
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== "object") return value
    const entry = value as Record<string, unknown>
    const next = Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, key === "activationInputs" ? undefined : visit(item)]))
    const roll = entry.roll as Record<string, unknown> | undefined
    if (typeof entry.formula === "string" || typeof roll?.formula === "string") next.activationInputs = { ...values }
    return next
  }
  return visit(ability) as Ability
}

export function validateAbilityInputReferences(ability: Pick<Ability, "manualInputs" | "bonuses" | "activationOptions" | "conditionOnUse">): string | undefined {
  if (ability.manualInputs === undefined) return undefined
  const ids = new Set((ability.manualInputs ?? []).map(input => input.id))
  function unknown(value: unknown): string | undefined {
    if (Array.isArray(value)) return value.map(unknown).find(Boolean)
    if (!value || typeof value !== "object") return undefined
    for (const [key, item] of Object.entries(value)) {
      if (key === "activationInputs") continue
      if (key === "formula" && typeof item === "string") {
        for (const match of item.matchAll(/\binput\.([A-Za-z][A-Za-z0-9_]*)/g)) if (!ids.has(match[1])) return `Entrada não definida na fórmula: input.${match[1]}.`
      } else {
        const result = unknown(item)
        if (result) return result
      }
    }
    return undefined
  }
  return unknown([ability.bonuses, ability.conditionOnUse?.bonuses, ...(ability.activationOptions ?? []).map(option => option.bonuses)])
}

/** Validate the actual inputs before any resource or HP mutation, including division by zero. */
export function validateAbilityInputFormulaValues(character: CharacterTemplate, ability: Ability, values: Record<string, number> = {}, optionId?: string): string | undefined {
  if (!ability.manualInputs?.length) return undefined
  function invalid(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(invalid)
    if (!value || typeof value !== "object") return false
    return Object.entries(value).some(([key, item]) => key === "formula" && typeof item === "string" && /\binput\./.test(item)
      ? evaluateCharacterSheetFormula(item, character, values) === undefined
      : key !== "activationInputs" && invalid(item))
  }
  const option = ability.activationOptions?.find(entry => entry.id === optionId)
  return invalid([ability.bonuses, ability.conditionOnUse?.bonuses, option?.bonuses, option?.condition?.bonuses])
    ? "A fórmula do efeito não pode ser calculada com os valores informados." : undefined
}
