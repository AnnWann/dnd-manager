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

export type CustomAbilityDiceGroupResolution = {
  quantity: number
  sides: number
  rolls: number[]
  kept?: number
}

export type CustomAbilityDamageRollResolution = {
  id: string
  label?: string
  /** Expressão efetiva exibida ao jogador, já incluindo o escalonamento. */
  dice: string
  baseDice: string
  upcastDicePerLevel?: string
  upcastLevels: number
  /** Resultado dos dados, preservando a semântica legada do total da expressão. */
  value: number
  /** Resultados individuais dos dados quando o sistema fez a rolagem digital. */
  groups?: CustomAbilityDiceGroupResolution[]
  /** Modificador literal embutido na expressão, por exemplo o +2 de 1d6+2. */
  diceModifier?: number
  /** Modificador adicional calculado por fórmula. */
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
  /** Resultados individuais dos dados quando o sistema fez a rolagem digital. */
  groups?: CustomAbilityDiceGroupResolution[]
  /** Modificador literal embutido na expressão genérica. */
  diceModifier?: number
  /** Total principal depois de modificadores. */
  total?: number
  natural?: number
  /** Raw d20 results, including both dice when rolling with advantage/disadvantage. */
  d20Rolls?: number[]
  d20Mode?: CustomAbilityRollDefinition["d20Mode"]
  modifier?: number
  dc?: number
  saveAttribute?: Attribute
  onSave?: CustomAbilityRollDefinition["onSave"]
  damages?: CustomAbilityDamageRollResolution[]
}

export function formatCustomRollResolutionSummary(
  resolution: CustomAbilityRollResolution,
): string[] {
  const lines: string[] = []

  if (
    resolution.kind === "attack"
    || resolution.kind === "abilityCheck"
    || resolution.kind === "savingThrow"
  ) {
    const label =
      resolution.kind === "attack"
        ? "Ataque"
        : resolution.kind === "abilityCheck"
          ? "Teste"
          : "Resistência"
    lines.push(
      `${label}: ${resolution.natural ?? resolution.value}${formatSignedPart(
        resolution.modifier ?? 0,
      )} = ${resolution.total ?? resolution.value}`,
    )
  } else if (resolution.kind === "targetSave") {
    const attribute = resolution.saveAttribute
      ? resolution.saveAttribute.toUpperCase()
      : ""
    const success =
      resolution.onSave === "half"
        ? " · sucesso: metade"
        : resolution.onSave === "full"
          ? " · sucesso: dano completo"
          : resolution.onSave === "none"
            ? " · sucesso: sem efeito"
            : ""
    lines.push(
      `Resistência do alvo: ${attribute ? `${attribute} ` : ""}CD ${resolution.dc ?? resolution.value}${success}`,
    )
  } else if (resolution.kind === "generic") {
    lines.push(
      `Rolagem: ${resolution.dice ? `${resolution.dice} = ` : ""}${resolution.value}${formatSignedPart(
        resolution.modifier ?? 0,
      )}${resolution.total !== undefined ? ` = ${resolution.total}` : ""}`,
    )
  }

  for (const damage of resolution.damages ?? []) {
    const type = damage.damageType?.trim()
      ? ` ${damage.damageType.trim()}`
      : ""
    const critical = damage.critical ? " · crítico" : ""
    lines.push(
      `${damage.label?.trim() || "Dano"}: ${damage.dice} = ${damage.value}${formatSignedPart(
        damage.modifier,
      )} = ${damage.total}${type}${critical}`,
    )
  }

  if (resolution.kind === "damage" && !(resolution.damages?.length)) {
    lines.push(`Dano total: ${resolution.total ?? resolution.value}`)
  }

  return lines
}

function formatSignedPart(value: number): string {
  if (!value) return ""
  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`
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
        resolved.kind === "generic" && !roll.modifierFormula?.trim()
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
        resolved.kind === "generic" && !action.roll.modifierFormula?.trim()
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

export function rollCustomAbilityDiceDetailed(
  expression: string,
  diceMultiplier = 1,
): {
  total: number
  modifier: number
  groups: CustomAbilityDiceGroupResolution[]
} {
  const error = validateCustomAbilityDiceExpression(expression)
  if (error) throw new Error(error)
  const parsed = parseDiceExpression(expression)!
  const multiplier = Math.max(1, Math.floor(diceMultiplier))
  const quantity = parsed.count * multiplier
  const rolls = Array.from(
    { length: quantity },
    () => randomInteger(parsed.sides) + 1,
  )
  return {
    total:
      rolls.reduce((sum, value) => sum + value, 0)
      + parsed.modifier,
    modifier: parsed.modifier,
    groups: [{
      quantity,
      sides: parsed.sides,
      rolls,
    }],
  }
}

export function rollCustomAbilityDice(
  expression: string,
  diceMultiplier = 1,
): number {
  return rollCustomAbilityDiceDetailed(
    expression,
    diceMultiplier,
  ).total
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

export function formatCustomDamageDiceForLevel(
  component: NonNullable<CustomAbilityRollDefinition["damage"]>[number],
  activationLevel?: number,
  activationBaseLevel = 1,
): string {
  const upcastLevels = resolveDamageUpcastLevels(
    component,
    activationLevel,
    activationBaseLevel,
  )
  return formatDamageDiceExpression(
    component.dice,
    component.upcastDicePerLevel,
    upcastLevels,
  )
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
  let groups: CustomAbilityDiceGroupResolution[] | undefined
  let diceModifier: number | undefined
  let natural: number | undefined
  let d20Rolls: number[] | undefined
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
    groups = resolved.groups
    diceModifier = resolved.diceModifier
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
    const resolvedD20 = resolveD20Value(
      roll,
      suppliedRollValue,
      subject,
      d20Mode,
    )
    natural = resolvedD20.natural
    d20Rolls = resolvedD20.rolls
    value = natural
    dice = "1d20"
    const rollAttribute = resolveRollAttribute(
      roll.attributeField,
      roll.attribute ?? (kind === "savingThrow" ? "con" : "str"),
      definition,
      state,
      abilityType,
      abilityValues,
    )
    modifier =
      resolveNativeD20Modifier(
        roll,
        kind,
        character,
        rollAttribute,
      )
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
    const dcAttribute = resolveRollAttribute(
      roll.dcAttributeField,
      roll.dcAttribute ?? roll.attribute ?? "str",
      definition,
      state,
      abilityType,
      abilityValues,
    )
    dc = resolveTargetSaveDc(
      roll,
      dcAttribute,
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
    groups,
    diceModifier,
    total,
    natural,
    d20Rolls,
    d20Mode:
      kind === "attack"
      || kind === "abilityCheck"
      || kind === "savingThrow"
        ? d20Mode
        : undefined,
    modifier,
    dc,
    saveAttribute:
      kind === "targetSave"
        ? roll.saveAttribute ?? "str"
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
): {
  value: number
  dice?: string
  groups?: CustomAbilityDiceGroupResolution[]
  diceModifier?: number
} {
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
  const rolled = rollCustomAbilityDiceDetailed(dice)
  return {
    value: rolled.total,
    dice,
    groups: rolled.groups,
    diceModifier: rolled.modifier,
  }
}

function resolveD20Value(
  roll: CustomAbilityRollDefinition,
  suppliedRollValue: number | undefined,
  subject: "habilidade" | "ação",
  mode: NonNullable<CustomAbilityRollDefinition["d20Mode"]>,
): { natural: number; rolls: number[] } {
  if (
    typeof suppliedRollValue === "number"
    && Number.isFinite(suppliedRollValue)
  ) {
    const natural = Math.trunc(suppliedRollValue)
    return { natural, rolls: [natural] }
  }
  if (roll.mode === "manual") {
    throw new Error(
      `Informe o resultado do d20 antes de usar esta ${subject}.`,
    )
  }

  const first = randomInteger(20) + 1
  if (mode === "normal") {
    return { natural: first, rolls: [first] }
  }

  const second = randomInteger(20) + 1
  return {
    natural:
      mode === "advantage"
        ? Math.max(first, second)
        : Math.min(first, second),
    rolls: [first, second],
  }
}

function resolveRollAttribute(
  reference: CustomAbilityRollDefinition["attributeField"],
  fallback: Attribute,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityType?: CustomAbilityTypeDefinition,
  abilityValues?: Record<string, JsonValue>,
): Attribute {
  if (!reference) return fallback

  const field =
    reference.scope === "ability"
      ? abilityType?.fields.find(
          (entry) =>
            entry.id === reference.fieldId
            && entry.type === "attribute",
        )
      : definition.fields.find(
          (entry) =>
            entry.id === reference.fieldId
            && entry.type === "attribute",
        )

  if (!field || field.type !== "attribute") return fallback

  const raw =
    reference.scope === "ability"
      ? abilityValues?.[field.id] ?? field.defaultValue
      : state.fields[field.id] ?? field.defaultValue

  const allowed: Attribute[] =
    field.allowedAttributes?.length
      ? field.allowedAttributes
      : ["str", "dex", "con", "int", "wis", "cha"]

  return typeof raw === "string" && allowed.includes(raw as Attribute)
    ? raw as Attribute
    : allowed[0] ?? fallback
}

function resolveNativeD20Modifier(
  roll: CustomAbilityRollDefinition,
  kind: "attack" | "abilityCheck" | "savingThrow",
  character: CharacterTemplate,
  attribute: Attribute,
): number {
  if (kind === "attack") {
    const base =
      character.getEffectiveAttributeModifier(attribute)
      + (roll.proficient === false ? 0 : character.getProficiencyBonus())
    return character.getEffectiveAttackBonus(base)
  }

  if (kind === "savingThrow") {
    return character.getSavingThrowBonus(attribute)
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
    const baseDice = resolveCustomRollDiceExpression(
      component.dice,
      definition,
      state,
      character,
      abilityType,
      abilityValues,
    )
    const upcastDicePerLevel = component.upcastDicePerLevel?.trim()
      ? resolveCustomRollDiceExpression(
          component.upcastDicePerLevel,
          definition,
          state,
          character,
          abilityType,
          abilityValues,
        )
      : undefined
    const upcastLevels = resolveDamageUpcastLevels(
      component,
      activationContext?.level,
      activationContext?.baseLevel ?? 1,
    )
    const dice = formatDamageDiceExpression(
      baseDice,
      upcastDicePerLevel,
      upcastLevels,
    )
    const isCritical =
      attackCritical && component.critical !== false
    let value: number

    const supplied = suppliedDamageValues?.[index]
    let groups: CustomAbilityDiceGroupResolution[] | undefined
    let diceModifier = 0
    if (typeof supplied === "number" && Number.isFinite(supplied)) {
      value = supplied
    } else if (roll.mode === "manual") {
      throw new Error(
        `Informe o resultado de dano “${component.label?.trim() || component.damageType?.trim() || index + 1}”.`,
      )
    } else {
      const diceMultiplier = isCritical ? 2 : 1
      const baseRoll = rollCustomAbilityDiceDetailed(
        baseDice,
        diceMultiplier,
      )
      value = baseRoll.total
      groups = [...baseRoll.groups]
      diceModifier += baseRoll.modifier

      if (upcastDicePerLevel && upcastLevels > 0) {
        for (let level = 0; level < upcastLevels; level += 1) {
          const upcastRoll = rollCustomAbilityDiceDetailed(
            upcastDicePerLevel,
            diceMultiplier,
          )
          value += upcastRoll.total
          groups.push(...upcastRoll.groups)
          diceModifier += upcastRoll.modifier
        }
      }
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
      baseDice,
      upcastDicePerLevel,
      upcastLevels,
      value,
      groups,
      diceModifier,
      modifier,
      total: value + modifier,
      damageType: component.damageType,
      critical: isCritical,
    }
  })
}

function resolveDamageUpcastLevels(
  component: NonNullable<CustomAbilityRollDefinition["damage"]>[number],
  activationLevel: number | undefined,
  activationBaseLevel: number,
): number {
  if (!component.upcastDicePerLevel?.trim()) return 0
  const baseLevel = Math.max(
    1,
    Math.floor(
      component.upcastBaseLevel
      ?? activationBaseLevel,
    ),
  )
  const level = Math.max(
    baseLevel,
    Math.floor(activationLevel ?? baseLevel),
  )
  return Math.max(0, level - baseLevel)
}

function formatDamageDiceExpression(
  baseDice: string,
  upcastDicePerLevel: string | undefined,
  upcastLevels: number,
): string {
  if (!upcastDicePerLevel || upcastLevels <= 0) return baseDice
  if (upcastLevels === 1) {
    return `${baseDice} + ${upcastDicePerLevel}`
  }
  return `${baseDice} + ${upcastLevels}×${upcastDicePerLevel}`
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