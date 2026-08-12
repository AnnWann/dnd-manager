import type {
  AbilityActionKind,
} from "../../models/abilities/Ability"
import type {
  CharacterCondition,
  ConditionDurationType,
} from "../../models/characters/CharacterCondition"
import {
  getCharacterConditions,
  withCharacterConditions,
} from "../../models/characters/characterConditionStorage"
import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomAbilityTypeDefinition,
  CustomPredefinedAbilityDefinition,
} from "../../models/customSystems/CustomAbilityDefinition"
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomResourceState,
  CustomSystemActionDefinition,
  CustomSystemConditionChangeDefinition,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { evaluateCustomFormula } from "./CustomFormulaEngineWithCharacter"

const ACTION_KINDS = new Set<AbilityActionKind>([
  "action",
  "bonusAction",
  "reaction",
  "legendaryAction",
  "legendaryReaction",
  "legendaryResistance",
  "free",
])

export function getEffectiveCustomAbilityActivation(
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
): CustomAbilityActivationDefinition {
  const preset = type.predefinedAbilities?.find(
    (entry) => entry.id === ability.predefinedAbilityId,
  )
  const activation = mergeActivation(type.activation, preset)
  const fieldKind = activation.actionKindFieldId
    ? ability.values[activation.actionKindFieldId]
    : undefined

  return {
    ...activation,
    actionKind:
      typeof fieldKind === "string" && ACTION_KINDS.has(fieldKind as AbilityActionKind)
        ? (fieldKind as AbilityActionKind)
        : normalizeActionKind(activation.actionKind),
  }
}

export function activateCustomSystemAction(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  sourceSystemId: string,
  actionId: string,
): CharacterTemplate {
  const originalStates = (character.get("sheet").customSystems ?? []) as CharacterCustomSystemState[]
  const states = originalStates.map(cloneState)
  const sourceState = requireState(states, sourceSystemId)
  const sourceDefinition = requireDefinition(definitions, sourceSystemId)
  const action = (sourceDefinition.actions ?? []).find((entry) => entry.id === actionId)

  if (!action) throw new Error(`A ação “${actionId}” não existe mais.`)
  if (action.enabled === false) throw new Error("Esta ação está desativada.")
  if (sourceState.enabled === false) throw new Error("Este sistema está desativado.")

  const resolvedChanges = (action.resourceChanges ?? []).map((change) => ({
    change,
    amount: resolveAmount(change, sourceDefinition, sourceState, character),
  }))

  validateResourceChanges(character, definitions, states, resolvedChanges)

  let nextCharacter = character
  for (const resolved of resolvedChanges) {
    nextCharacter = applyResourceChange(
      nextCharacter,
      definitions,
      states,
      resolved.change,
      resolved.amount,
    )
  }

  for (const conditionChange of action.conditionChanges ?? []) {
    nextCharacter = applyConditionChange(
      nextCharacter,
      sourceDefinition,
      action,
      conditionChange,
    )
  }

  return nextCharacter.withSheet("customSystems", states)
}

function mergeActivation(
  base: CustomAbilityActivationDefinition | undefined,
  preset: CustomPredefinedAbilityDefinition | undefined,
): CustomAbilityActivationDefinition {
  if (!preset?.activation) return base ?? {}
  return {
    ...base,
    ...preset.activation,
    usage: preset.activation.usage ?? base?.usage,
    resourceChanges:
      preset.activation.resourceChanges ?? base?.resourceChanges,
    conditionChanges:
      preset.activation.conditionChanges ?? base?.conditionChanges,
  }
}

function normalizeActionKind(
  value: unknown,
): AbilityActionKind | undefined {
  if (value === "freeAction") return "free"
  return typeof value === "string" && ACTION_KINDS.has(value as AbilityActionKind)
    ? (value as AbilityActionKind)
    : undefined
}

function resolveAmount(
  change: CustomAbilityResourceChangeDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): number {
  if (change.formula?.trim()) {
    const result = evaluateCustomFormula(
      change.formula,
      definition,
      state,
      character,
    )
    if (
      !result.ok ||
      typeof result.value !== "number" ||
      !Number.isFinite(result.value)
    ) {
      throw new Error(
        `A fórmula do efeito de recurso “${change.id}” não retornou um número válido.`,
      )
    }
    return Math.max(0, result.value)
  }
  return Math.max(0, change.amount ?? 0)
}

function validateResourceChanges(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  changes: Array<{
    change: CustomAbilityResourceChangeDefinition
    amount: number
  }>,
) {
  for (const { change, amount } of changes) {
    if (change.operation !== "spend") continue

    if (change.target.source === "native") {
      const available = nativeResourceValue(character, change.target.resource)
      if (available < amount && change.target.resource !== "hitPoints") {
        throw new Error("Recurso nativo insuficiente para usar a ação.")
      }
      continue
    }

    const state = requireState(states, change.target.systemId)
    const definition = requireDefinition(definitions, change.target.systemId)
    const resource = definition.resources.find(
      (entry) => entry.id === change.target.resourceId,
    )
    const resourceState = state.resources[change.target.resourceId]
    if (!resource || !resourceState) {
      throw new Error(
        `O recurso “${change.target.resourceId}” não está disponível.`,
      )
    }
    const minimum = resource.minimum ?? 0
    if (resourceState.current - amount < minimum) {
      throw new Error(`Não há ${resource.name} suficiente para usar a ação.`)
    }
  }
}

function applyResourceChange(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  change: CustomAbilityResourceChangeDefinition,
  amount: number,
): CharacterTemplate {
  if (change.target.source === "native") {
    return applyNativeChange(
      character,
      change.target.resource,
      change.operation,
      amount,
    )
  }

  const state = requireState(states, change.target.systemId)
  const definition = requireDefinition(definitions, change.target.systemId)
  const resource = definition.resources.find(
    (entry) => entry.id === change.target.resourceId,
  )
  const current = state.resources[change.target.resourceId]
  if (!resource || !current) {
    throw new Error(
      `O recurso “${change.target.resourceId}” não está disponível.`,
    )
  }

  const raw = operationValue(current.current, change.operation, amount)
  const maximum = current.maximum ?? resource.maximum
  state.resources[change.target.resourceId] = {
    ...current,
    current: clamp(raw, resource.minimum, maximum),
  }
  return character
}

function applyNativeChange(
  character: CharacterTemplate,
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
  operation: "spend" | "gain" | "set",
  amount: number,
): CharacterTemplate {
  if (resource === "hitPoints") {
    if (operation === "spend") return character.takeDamage(amount)
    if (operation === "gain") return character.heal(amount)
    return character.setCurrentHp(amount)
  }

  if (resource === "temporaryHitPoints") {
    const current = character.get("sheet").HP.temporary ?? 0
    if (operation === "gain") return character.addTemporaryHp(amount)
    return character.setTemporaryHp(
      Math.max(0, operation === "set" ? amount : current - amount),
    )
  }

  if (resource === "inspiration") {
    const next =
      operation === "spend" ? false : operation === "gain" ? true : amount > 0
    return character.withStat("inspiration", next)
  }

  const current = character.get("sheet").stats.exhaustion ?? 0
  return character.withStat(
    "exhaustion",
    clamp(operationValue(current, operation, amount), 0, 6),
  )
}

function nativeResourceValue(
  character: CharacterTemplate,
  resource: "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion",
): number {
  if (resource === "hitPoints") return character.get("sheet").HP.current
  if (resource === "temporaryHitPoints") {
    return character.get("sheet").HP.temporary ?? 0
  }
  if (resource === "inspiration") {
    return character.get("sheet").stats.inspiration ? 1 : 0
  }
  return character.get("sheet").stats.exhaustion ?? 0
}

function applyConditionChange(
  character: CharacterTemplate,
  definition: CustomSystemDefinition,
  action: CustomSystemActionDefinition,
  change: CustomSystemConditionChangeDefinition,
): CharacterTemplate {
  const name = change.name.trim()
  if (!name) return character

  const normalizedName = normalize(name)
  const conditions = getCharacterConditions(character)

  if (change.operation === "remove") {
    return withCharacterConditions(
      character,
      conditions.filter((condition) => normalize(condition.name) !== normalizedName),
    )
  }

  const source = change.source?.trim() || definition.name
  const condition: CharacterCondition = {
    id: crypto.randomUUID(),
    name,
    description: change.description?.trim() ?? "",
    behavior: change.behavior?.trim() ?? "",
    source,
    notes: change.notes?.trim() || `Aplicada pela ação ${action.name}.`,
    tags: change.tags?.filter(Boolean) ?? [],
    bonuses: change.bonuses,
    duration: buildDuration(change.duration),
    createdAt: new Date().toISOString(),
    sourceCharacterId: change.sourceCharacterId,
    linkedCombatantId: change.linkedCombatantId,
  }

  return withCharacterConditions(character, [
    ...conditions.filter(
      (existing) =>
        !(
          normalize(existing.name) === normalizedName &&
          normalize(existing.source) === normalize(source)
        ),
    ),
    condition,
  ])
}

function buildDuration(
  duration: CustomSystemConditionChangeDefinition["duration"],
): CharacterCondition["duration"] {
  const type: ConditionDurationType = duration?.type ?? "permanent"
  const numeric = isNumericDuration(type)
  const legacyAmount = duration?.amount
  const total = numeric ? Math.max(0, duration?.total ?? legacyAmount ?? 1) : undefined
  const remaining = numeric ? Math.max(0, duration?.remaining ?? total ?? 1) : undefined

  return {
    type,
    total,
    remaining,
    tickOn: duration?.tickOn,
    tickOwner: duration?.tickOwner,
    customLabel: type === "custom" ? duration?.customLabel : undefined,
    autoRemoveAtZero: duration?.autoRemoveAtZero ?? true,
    expiresAt: duration?.expiresAt,
  }
}

function isNumericDuration(type: ConditionDurationType) {
  return (
    type === "rounds" ||
    type === "turns" ||
    type === "minutes" ||
    type === "hours" ||
    type === "days"
  )
}

function operationValue(
  current: number,
  operation: "spend" | "gain" | "set",
  amount: number,
) {
  if (operation === "spend") return current - amount
  if (operation === "gain") return current + amount
  return amount
}

function clamp(value: number, minimum?: number, maximum?: number) {
  const lower = minimum === undefined ? value : Math.max(minimum, value)
  return maximum === undefined ? lower : Math.min(maximum, lower)
}

function requireState(
  states: CharacterCustomSystemState[],
  systemId: string,
): CharacterCustomSystemState {
  const state = states.find((entry) => entry.systemId === systemId)
  if (!state) {
    throw new Error(`O sistema “${systemId}” não está instalado neste personagem.`)
  }
  return state
}

function requireDefinition(
  definitions: CustomSystemDefinition[],
  systemId: string,
): CustomSystemDefinition {
  const definition = definitions.find((entry) => entry.id === systemId)
  if (!definition) {
    throw new Error(`A definição do sistema “${systemId}” não está disponível.`)
  }
  return definition
}

function cloneState(
  state: CharacterCustomSystemState,
): CharacterCustomSystemState {
  return {
    ...state,
    fields: { ...state.fields },
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([id, resource]) => [
        id,
        { ...resource } satisfies CustomResourceState,
      ]),
    ),
    abilities: state.abilities.map((ability) => ({
      ...ability,
      values: { ...ability.values },
      usage: ability.usage ? { ...ability.usage } : undefined,
    })),
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
