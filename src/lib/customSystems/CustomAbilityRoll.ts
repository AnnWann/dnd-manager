import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityRollDefinition,
  CustomAbilityTypeDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemActionDefinition,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { activateCustomAbility } from "./CustomAbilityActivation"
import {
  evaluateCustomFormula,
  listCustomFormulaVariables,
} from "./CustomFormulaEngineWithCharacter"
import {
  activateCustomSystemAction,
  getEffectiveCustomAbilityActivation,
} from "./CustomSystemActions"

export type CustomAbilityRollResolution = {
  mode: CustomAbilityRollDefinition["mode"]
  /** Resultado dos dados / valor manual antes da fórmula do efeito. */
  value: number
  dice?: string
  /** Primeiro total numérico de uma fórmula de efeito que use roll.value. */
  total?: number
}

export function getCustomAbilityRollDefinition(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
): CustomAbilityRollDefinition | undefined {
  const ability = state.abilities.find((entry) => entry.id === abilityId)
  if (!ability) return undefined
  const type = definition.abilityTypes.find((entry) => entry.id === ability.abilityTypeId)
  if (!type) return undefined
  return getEffectiveCustomAbilityActivation(type, ability).roll
}

export function activateCustomAbilityWithRoll(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  systemId: string,
  abilityId: string,
  suppliedRollValue?: number,
  activationLevel?: number,
): { character: CharacterTemplate; roll?: CustomAbilityRollResolution } {
  const state = (character.get("sheet").customSystems ?? []).find(
    (entry) => entry.systemId === systemId,
  )
  const definition = definitions.find((entry) => entry.id === systemId)
  const ability = state?.abilities.find((entry) => entry.id === abilityId)
  const type = ability && definition?.abilityTypes.find(
    (entry) => entry.id === ability.abilityTypeId,
  )
  if (!state || !definition || !ability || !type) {
    return {
      character: activateCustomAbility(character, definitions, systemId, abilityId, activationLevel),
    }
  }

  const roll = getCustomAbilityRollDefinition(definition, state, abilityId)
  if (!roll) {
    return {
      character: activateCustomAbility(character, definitions, systemId, abilityId, activationLevel),
    }
  }

  const resolved = resolveRollValue(
    roll,
    suppliedRollValue,
    "habilidade",
    definition,
    state,
    character,
    type,
    ability.values,
  )
  const resolvedDefinitions = replaceRollValueForAbility(
    definitions,
    systemId,
    ability,
    resolved.value,
  )

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  return {
    character: activateCustomAbility(
      character,
      resolvedDefinitions,
      systemId,
      abilityId,
      activationLevel,
    ),
    roll: {
      mode: roll.mode,
      value: resolved.value,
      dice: resolved.dice,
      total: resolveRollFormulaTotal(
        activation.resourceChanges,
        resolved.value,
        definition,
        state,
        character,
        type,
        ability.values,
      ),
    },
  }
}

export function activateCustomSystemActionWithRoll(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  systemId: string,
  actionId: string,
  suppliedRollValue?: number,
): { character: CharacterTemplate; roll?: CustomAbilityRollResolution } {
  const definition = definitions.find((entry) => entry.id === systemId)
  const state = (character.get("sheet").customSystems ?? []).find(
    (entry) => entry.systemId === systemId,
  )
  const action = definition?.actions?.find((entry) => entry.id === actionId)
  if (!definition || !state || !action || !action.roll) {
    return {
      character: activateCustomSystemAction(
        character,
        definitions,
        systemId,
        actionId,
      ),
    }
  }

  const resolved = resolveRollValue(
    action.roll,
    suppliedRollValue,
    "ação",
    definition,
    state,
    character,
  )
  const resolvedDefinitions = replaceRollValueForAction(
    definitions,
    systemId,
    action,
    resolved.value,
  )

  return {
    character: activateCustomSystemAction(
      character,
      resolvedDefinitions,
      systemId,
      actionId,
    ),
    roll: {
      mode: action.roll.mode,
      value: resolved.value,
      dice: resolved.dice,
      total: resolveRollFormulaTotal(
        action.resourceChanges,
        resolved.value,
        definition,
        state,
        character,
      ),
    },
  }
}

export function validateCustomAbilityDiceExpression(
  expression: string | undefined,
): string | undefined {
  const value = expression?.trim() ?? ""
  if (!value) return "Informe os dados da rolagem, por exemplo 1d6."
  const parsed = parseDiceExpression(value)
  if (!parsed) return "Use uma notação como 1d6, 2d8+1 ou 1d10-1."
  if (parsed.count < 1 || parsed.count > 100) {
    return "A rolagem deve usar entre 1 e 100 dados."
  }
  if (parsed.sides < 2 || parsed.sides > 1000) {
    return "Cada dado deve ter entre 2 e 1000 lados."
  }
  return undefined
}

export function validateCustomAbilityDiceSource(
  expression: string | undefined,
  definition: CustomSystemDefinition,
  abilityType?: CustomAbilityTypeDefinition,
): string | undefined {
  const value = expression?.trim() ?? ""
  if (!value) return "Informe os dados da rolagem, por exemplo 1d6, ou selecione uma variável do tipo Dado."
  if (!validateCustomAbilityDiceExpression(value)) return undefined

  const variable = listCustomFormulaVariables(definition, abilityType).find(
    (entry) => entry.path === value,
  )
  if (variable?.valueType === "dice") return undefined

  return "Use uma notação como 1d6 ou selecione uma variável cujo tipo seja Dado."
}

export function resolveCustomRollDiceExpression(
  expression: string | undefined,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character?: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): string {
  const value = expression?.trim() ?? ""
  const literalError = validateCustomAbilityDiceExpression(value)
  if (!literalError) return value

  if (!value) throw new Error(literalError)
  const result = evaluateCustomFormula(
    value,
    definition,
    state,
    character,
    abilityType ? { type: abilityType, values: abilityValues } : undefined,
  )
  if (!result.ok) throw new Error(result.error)
  if (typeof result.value !== "string") {
    throw new Error("A variável usada como dado precisa retornar um valor como d6 ou 2d8+1.")
  }

  const resolved = result.value.trim()
  const resolvedError = validateCustomAbilityDiceExpression(resolved)
  if (resolvedError) {
    throw new Error(`A variável de dado retornou “${resolved}”. ${resolvedError}`)
  }
  return resolved
}

export function rollCustomAbilityDice(expression: string): number {
  const error = validateCustomAbilityDiceExpression(expression)
  if (error) throw new Error(error)
  const parsed = parseDiceExpression(expression)!
  let total = parsed.modifier
  for (let index = 0; index < parsed.count; index += 1) {
    total += randomInteger(parsed.sides) + 1
  }
  return total
}

function resolveRollValue(
  roll: CustomAbilityRollDefinition,
  suppliedRollValue: number | undefined,
  subject: "habilidade" | "ação",
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): { value: number; dice?: string } {
  if (roll.mode === "manual") {
    if (typeof suppliedRollValue !== "number" || !Number.isFinite(suppliedRollValue)) {
      throw new Error(`Informe o resultado da rolagem antes de usar esta ${subject}.`)
    }
    return {
      value: suppliedRollValue,
      dice: roll.dice?.trim()
        ? resolveCustomRollDiceExpression(
            roll.dice,
            definition,
            state,
            character,
            abilityType,
            abilityValues,
          )
        : undefined,
    }
  }

  const dice = resolveCustomRollDiceExpression(
    roll.dice,
    definition,
    state,
    character,
    abilityType,
    abilityValues,
  )
  return { value: rollCustomAbilityDice(dice), dice }
}

function resolveRollFormulaTotal(
  changes: CustomAbilityActivationDefinition["resourceChanges"] | undefined,
  rollValue: number,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): number {
  for (const change of changes ?? []) {
    const formula = change.formula?.trim()
    if (!formula?.includes("roll.value")) continue
    const replaced = replaceRollToken(formula, rollValue)
    if (!replaced) continue
    const result = evaluateCustomFormula(
      replaced,
      definition,
      state,
      character,
      abilityType ? { type: abilityType, values: abilityValues } : undefined,
    )
    if (result.ok && typeof result.value === "number" && Number.isFinite(result.value)) {
      return result.value
    }
  }
  return rollValue
}

function replaceRollValueForAbility(
  definitions: CustomSystemDefinition[],
  systemId: string,
  ability: CustomAbilityInstance,
  rollValue: number,
): CustomSystemDefinition[] {
  return definitions.map((definition) => {
    if (definition.id !== systemId) return definition

    return {
      ...definition,
      abilityTypes: definition.abilityTypes.map((type) => {
        if (type.id !== ability.abilityTypeId) return type
        return {
          ...type,
          activation: patchActivationRollFormula(type.activation, rollValue),
          predefinedAbilities: type.predefinedAbilities?.map((preset) =>
            preset.id === ability.predefinedAbilityId
              ? {
                  ...preset,
                  activation: patchActivationRollFormula(
                    preset.activation,
                    rollValue,
                  ),
                }
              : preset,
          ),
        }
      }),
    }
  })
}

function replaceRollValueForAction(
  definitions: CustomSystemDefinition[],
  systemId: string,
  action: CustomSystemActionDefinition,
  rollValue: number,
): CustomSystemDefinition[] {
  return definitions.map((definition) =>
    definition.id !== systemId
      ? definition
      : {
          ...definition,
          actions: definition.actions?.map((entry) =>
            entry.id !== action.id
              ? entry
              : {
                  ...entry,
                  resourceChanges: entry.resourceChanges?.map((change) => ({
                    ...change,
                    formula: replaceRollToken(change.formula, rollValue),
                  })),
                },
          ),
        },
  )
}

function patchActivationRollFormula(
  activation: CustomAbilityActivationDefinition | undefined,
  rollValue: number,
): CustomAbilityActivationDefinition | undefined {
  if (!activation) return activation
  return {
    ...activation,
    resourceChanges: activation.resourceChanges?.map((change) => ({
      ...change,
      formula: replaceRollToken(change.formula, rollValue),
    })),
  }
}

function replaceRollToken(
  formula: string | undefined,
  value: number,
): string | undefined {
  if (!formula?.includes("roll.value")) return formula
  return formula.replace(
    /(^|[^A-Za-z0-9_.-])roll\.value(?=$|[^A-Za-z0-9_.-])/g,
    (_match, prefix: string) => `${prefix}(${value})`,
  )
}

function parseDiceExpression(expression: string): {
  count: number
  sides: number
  modifier: number
} | undefined {
  const match = expression.trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
  if (!match) return undefined
  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const modifierValue = match[4] ? Number(match[4]) : 0
  const modifier = match[3] === "-" ? -modifierValue : modifierValue
  if (![count, sides, modifier].every(Number.isFinite)) return undefined
  return { count, sides, modifier }
}

type CryptoRandomSource = {
  getRandomValues: (buffer: Uint32Array) => Uint32Array
}

function randomInteger(maxExclusive: number): number {
  const cryptoObject = (
    globalThis as unknown as { crypto?: CryptoRandomSource }
  ).crypto
  if (cryptoObject?.getRandomValues) {
    const range = 0x1_0000_0000
    const limit = range - (range % maxExclusive)
    const buffer = new Uint32Array(1)
    do {
      cryptoObject.getRandomValues(buffer)
    } while (buffer[0] >= limit)
    return buffer[0] % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}