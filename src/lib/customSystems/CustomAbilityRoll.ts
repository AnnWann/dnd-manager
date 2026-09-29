import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityRollDefinition,
  CustomAbilityTypeDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type { JsonValue } from "../../models/customSystems/CustomGenerals"
import type { Attribute } from "../../models/sheet/Attribute"
import type { Skill } from "../../models/sheet/Skills"
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

export type CustomAbilityDamageRollResolution = {
  id: string
  label?: string
  dice: string
  /** Resultado somente dos dados / valor manual informado. */
  value: number
  modifier: number
  total: number
  damageType?: string
  critical: boolean
}

export type CustomAbilityRollResolution = {
  mode: CustomAbilityRollDefinition["mode"]
  kind: NonNullable<CustomAbilityRollDefinition["kind"]>
  /**
   * Valor primário da rolagem. Em d20 é o resultado natural; em rolagem
   * genérica é o resultado dos dados; em dano puro é a soma dos danos; em
   * resistência do alvo é a CD.
   */
  value: number
  dice?: string
  /** Total principal depois de modificadores. */
  total?: number
  natural?: number
  modifier?: number
  dc?: number
  saveAttribute?: Attribute
  onSave?: CustomAbilityRollDefinition["onSave"]
  damages?: CustomAbilityDamageRollResolution[]
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
  suppliedDamageValues?: number[],
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

  const activation = getEffectiveCustomAbilityActivation(type, ability)
  const resolved = resolveStructuredRoll(
    roll,
    suppliedRollValue,
    suppliedDamageValues,
    "habilidade",
    definition,
    state,
    character,
    type,
    ability.values,
    {
      level: activationLevel ?? activation.level?.baseLevel ?? 1,
      baseLevel: activation.level?.baseLevel ?? 1,
      scope: "ability",
    },
  )
  const resolvedDefinitions = replaceRollValueForAbility(
    definitions,
    systemId,
    ability,
    resolved.value,
  )

  return {
    character: activateCustomAbility(
      character,
      resolvedDefinitions,
      systemId,
      abilityId,
      activationLevel,
    ),
    roll: {
      ...resolved,
      total:
        resolved.kind === "generic"
          ? resolveRollFormulaTotal(
              activation.resourceChanges,
              resolved.value,
              definition,
              state,
              character,
              type,
              ability.values,
              {
                level: activationLevel ?? activation.level?.baseLevel ?? 1,
                baseLevel: activation.level?.baseLevel ?? 1,
                scope: "ability",
              },
            )
          : resolved.total,
    },
  }
}

export function activateCustomSystemActionWithRoll(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  systemId: string,
  actionId: string,
  suppliedRollValue?: number,
  activationLevel?: number,
  suppliedDamageValues?: number[],
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
        activationLevel,
      ),
    }
  }

  const resolved = resolveStructuredRoll(
    action.roll,
    suppliedRollValue,
    suppliedDamageValues,
    "ação",
    definition,
    state,
    character,
    undefined,
    undefined,
    {
      level: activationLevel ?? action.level?.baseLevel ?? 1,
      baseLevel: action.level?.baseLevel ?? 1,
      scope: "action",
    },
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
      activationLevel,
    ),
    roll: {
      ...resolved,
      total:
        resolved.kind === "generic"
          ? resolveRollFormulaTotal(
              action.resourceChanges,
              resolved.value,
              definition,
              state,
              character,
              undefined,
              undefined,
              {
                level: activationLevel ?? action.level?.baseLevel ?? 1,
                baseLevel: action.level?.baseLevel ?? 1,
                scope: "action",
              },
            )
          : resolved.total,
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

export function rollCustomAbilityDice(
  expression: string,
  diceMultiplier = 1,
): number {
  const error = validateCustomAbilityDiceExpression(expression)
  if (error) throw new Error(error)
  const parsed = parseDiceExpression(expression)!
  const multiplier = Math.max(1, Math.floor(diceMultiplier))
  let total = parsed.modifier
  for (let index = 0; index < parsed.count * multiplier; index += 1) {
    total += randomInteger(parsed.sides) + 1
  }
  return total
}

export function customRollKind(
  roll: CustomAbilityRollDefinition,
): NonNullable<CustomAbilityRollDefinition["kind"]> {
  return roll.kind ?? "generic"
}

export function customRollRequiresManualPrimary(
  roll: CustomAbilityRollDefinition,
): boolean {
  const kind = customRollKind(roll)
  return kind !== "targetSave" && kind !== "damage"
}

export function customRollManualDamageCount(
  roll: CustomAbilityRollDefinition,
): number {
  return roll.damage?.length ?? 0
}

function resolveStructuredRoll(
  roll: CustomAbilityRollDefinition,
  suppliedRollValue: number | undefined,
  suppliedDamageValues: number[] | undefined,
  subject: "habilidade" | "ação",
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
  activationContext?: {
    level?: number
    baseLevel?: number
    scope?: "ability" | "action"
  },
): CustomAbilityRollResolution {
  const kind = customRollKind(roll)
  const d20Mode = roll.d20Mode ?? "normal"
  let value = 0
  let total: number | undefined
  let dice: string | undefined
  let natural: number | undefined
  let modifier: number | undefined
  let dc: number | undefined

  if (kind === "generic") {
    const resolved = resolvePrimaryDice(
      roll,
      suppliedRollValue,
      subject,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
    )
    value = resolved.value
    dice = resolved.dice
    modifier = resolveFormulaNumber(
      roll.modifierFormula,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
      activationContext,
      value,
    )
    total = value + modifier
  } else if (
    kind === "attack"
    || kind === "abilityCheck"
    || kind === "savingThrow"
  ) {
    natural = resolveD20Value(
      roll,
      suppliedRollValue,
      subject,
      d20Mode,
    )
    value = natural
    dice = "1d20"
    modifier =
      resolveNativeD20Modifier(roll, kind, character)
      + resolveFormulaNumber(
        roll.modifierFormula,
        definition,
        state,
        character,
        abilityType,
        abilityValues,
        activationContext,
        value,
      )
    total = natural + modifier
  } else if (kind === "targetSave") {
    const attribute = roll.saveAttribute ?? roll.attribute ?? "str"
    dc = resolveTargetSaveDc(
      roll,
      attribute,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
      activationContext,
    )
    value = dc
    total = dc
  }

  const critical = kind === "attack" && natural === 20
  const damages = resolveDamageRolls(
    roll,
    suppliedDamageValues,
    definition,
    state,
    character,
    abilityType,
    abilityValues,
    activationContext,
    critical,
    value,
  )

  if (kind === "damage") {
    value = damages.reduce((sum, damage) => sum + damage.total, 0)
    total = value
  }

  return {
    mode: roll.mode,
    kind,
    value,
    dice,
    total,
    natural,
    modifier,
    dc,
    saveAttribute:
      kind === "targetSave"
        ? roll.saveAttribute ?? roll.attribute ?? "str"
        : undefined,
    onSave: kind === "targetSave" ? roll.onSave ?? "none" : undefined,
    damages: damages.length ? damages : undefined,
  }
}

function resolvePrimaryDice(
  roll: CustomAbilityRollDefinition,
  suppliedRollValue: number | undefined,
  subject: "habilidade" | "ação",
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): { value: number; dice?: string } {
  if (
    typeof suppliedRollValue === "number"
    && Number.isFinite(suppliedRollValue)
  ) {
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

  if (roll.mode === "manual") {
    throw new Error(
      `Informe o resultado da rolagem antes de usar esta ${subject}.`,
    )
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

function resolveD20Value(
  roll: CustomAbilityRollDefinition,
  suppliedRollValue: number | undefined,
  subject: "habilidade" | "ação",
  mode: NonNullable<CustomAbilityRollDefinition["d20Mode"]>,
): number {
  if (
    typeof suppliedRollValue === "number"
    && Number.isFinite(suppliedRollValue)
  ) {
    return Math.trunc(suppliedRollValue)
  }
  if (roll.mode === "manual") {
    throw new Error(
      `Informe o resultado do d20 antes de usar esta ${subject}.`,
    )
  }

  const first = randomInteger(20) + 1
  if (mode === "normal") return first
  const second = randomInteger(20) + 1
  return mode === "advantage"
    ? Math.max(first, second)
    : Math.min(first, second)
}

function resolveNativeD20Modifier(
  roll: CustomAbilityRollDefinition,
  kind: "attack" | "abilityCheck" | "savingThrow",
  character: CharacterTemplate,
): number {
  if (kind === "attack") {
    const attribute = roll.attribute ?? "str"
    const base =
      character.getEffectiveAttributeModifier(attribute)
      + (roll.proficient === false ? 0 : character.getProficiencyBonus())
    return character.getEffectiveAttackBonus(base)
  }

  if (kind === "savingThrow") {
    return character.getSavingThrowBonus(roll.attribute ?? "con")
  }

  if (roll.skill) {
    const attribute = SKILL_ATTRIBUTES[roll.skill]
    const proficiency = character.get("sheet").skills?.[roll.skill] ?? "none"
    const multiplier =
      proficiency === "expertise"
        ? 2
        : proficiency === "proficient"
          ? 1
          : 0
    const base =
      character.getEffectiveAttributeModifier(attribute)
      + character.getProficiencyBonus() * multiplier
    return character.getEffectiveSkillCheckBonus(
      roll.skill,
      attribute,
      base,
    )
  }

  const attribute = roll.attribute ?? "str"
  return character.getEffectiveAbilityCheckBonus(attribute)
}

function resolveTargetSaveDc(
  roll: CustomAbilityRollDefinition,
  attribute: Attribute,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType: CustomAbilityTypeDefinition | undefined,
  abilityValues: Record<string, JsonValue> | undefined,
  activationContext: {
    level?: number
    baseLevel?: number
    scope?: "ability" | "action"
  } | undefined,
): number {
  if (roll.dcFormula?.trim()) {
    return Math.max(
      0,
      Math.floor(
        resolveFormulaNumber(
          roll.dcFormula,
          definition,
          state,
          character,
          abilityType,
          abilityValues,
          activationContext,
        ),
      ),
    )
  }

  const base =
    8
    + character.getProficiencyBonus()
    + character.getEffectiveAttributeModifier(attribute)
  return character.getEffectiveAbilitySaveDc(attribute, base)
}

function resolveDamageRolls(
  roll: CustomAbilityRollDefinition,
  suppliedDamageValues: number[] | undefined,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType: CustomAbilityTypeDefinition | undefined,
  abilityValues: Record<string, JsonValue> | undefined,
  activationContext: {
    level?: number
    baseLevel?: number
    scope?: "ability" | "action"
  } | undefined,
  attackCritical: boolean,
  primaryValue: number,
): CustomAbilityDamageRollResolution[] {
  return (roll.damage ?? []).map((component, index) => {
    const dice = resolveCustomRollDiceExpression(
      component.dice,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
    )
    const isCritical =
      attackCritical && component.critical !== false
    let value: number

    const supplied = suppliedDamageValues?.[index]
    if (typeof supplied === "number" && Number.isFinite(supplied)) {
      value = supplied
    } else if (roll.mode === "manual") {
      throw new Error(
        `Informe o resultado de dano “${component.label?.trim() || component.damageType?.trim() || index + 1}”.`,
      )
    } else {
      value = rollCustomAbilityDice(dice, isCritical ? 2 : 1)
    }

    const modifier = resolveFormulaNumber(
      component.modifierFormula,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
      activationContext,
      primaryValue,
    )

    return {
      id: component.id,
      label: component.label,
      dice,
      value,
      modifier,
      total: value + modifier,
      damageType: component.damageType,
      critical: isCritical,
    }
  })
}

function resolveFormulaNumber(
  formula: string | undefined,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
  activationContext?: {
    level?: number
    baseLevel?: number
    scope?: "ability" | "action"
  },
  rollValue?: number,
): number {
  if (!formula?.trim()) return 0
  const prepared =
    rollValue === undefined
      ? formula
      : replaceRollToken(formula, rollValue) ?? formula
  const result = evaluateCustomFormula(
    prepared,
    definition,
    state,
    character,
    abilityType ? { type: abilityType, values: abilityValues } : undefined,
    activationContext,
  )
  if (!result.ok) throw new Error(result.error)
  if (typeof result.value !== "number" || !Number.isFinite(result.value)) {
    throw new Error("A fórmula da rolagem precisa resultar em um número.")
  }
  return result.value
}

const SKILL_ATTRIBUTES: Record<Skill, Attribute> = {
  acrobatics: "dex",
  animalHandling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleightOfHand: "dex",
  stealth: "dex",
  survival: "wis",
}

function resolveRollFormulaTotal(
  changes: CustomAbilityActivationDefinition["resourceChanges"] | undefined,
  rollValue: number,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
  activationContext?: {
    level?: number
    baseLevel?: number
    scope?: "ability" | "action"
  },
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
      activationContext,
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