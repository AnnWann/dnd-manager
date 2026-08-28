import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityRollDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { activateCustomAbility } from "./CustomAbilityActivation"
import { getEffectiveCustomAbilityActivation } from "./CustomSystemActions"

export type CustomAbilityRollResolution = {
  mode: CustomAbilityRollDefinition["mode"]
  value: number
  dice?: string
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
): { character: CharacterTemplate; roll?: CustomAbilityRollResolution } {
  const state = (character.get("sheet").customSystems ?? []).find(
    (entry) => entry.systemId === systemId,
  )
  const definition = definitions.find((entry) => entry.id === systemId)
  if (!state || !definition) {
    return {
      character: activateCustomAbility(character, definitions, systemId, abilityId),
    }
  }

  const roll = getCustomAbilityRollDefinition(definition, state, abilityId)
  if (!roll) {
    return {
      character: activateCustomAbility(character, definitions, systemId, abilityId),
    }
  }

  const value = resolveRollValue(roll, suppliedRollValue)
  const resolvedDefinitions = replaceRollValueForAbility(
    definitions,
    systemId,
    abilityId,
    value,
  )

  return {
    character: activateCustomAbility(
      character,
      resolvedDefinitions,
      systemId,
      abilityId,
    ),
    roll: {
      mode: roll.mode,
      value,
      dice: roll.dice?.trim() || undefined,
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
  suppliedRollValue?: number,
): number {
  if (roll.mode === "manual") {
    if (typeof suppliedRollValue !== "number" || !Number.isFinite(suppliedRollValue)) {
      throw new Error("Informe o resultado da rolagem antes de usar esta habilidade.")
    }
    return suppliedRollValue
  }

  const dice = roll.dice?.trim() ?? ""
  const error = validateCustomAbilityDiceExpression(dice)
  if (error) throw new Error(error)
  return rollCustomAbilityDice(dice)
}

function replaceRollValueForAbility(
  definitions: CustomSystemDefinition[],
  systemId: string,
  abilityId: string,
  rollValue: number,
): CustomSystemDefinition[] {
  return definitions.map((definition) => {
    if (definition.id !== systemId) return definition
    const stateTypeIds = new Set<string>()

    return {
      ...definition,
      abilityTypes: definition.abilityTypes.map((type) => {
        const matchingPresetIds = new Set(
          (type.predefinedAbilities ?? [])
            .filter((preset) => preset.id)
            .map((preset) => preset.id),
        )
        const shouldPatchBase = true
        if (shouldPatchBase) stateTypeIds.add(type.id)

        return {
          ...type,
          activation: patchActivationRollFormula(type.activation, rollValue),
          predefinedAbilities: type.predefinedAbilities?.map((preset) =>
            matchingPresetIds.has(preset.id)
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

function randomInteger(maxExclusive: number): number {
  const cryptoObject = globalThis.crypto
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
