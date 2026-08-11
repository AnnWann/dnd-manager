// @ts-nocheck
import type {
  CharacterCondition,
  ConditionDurationType,
} from '../../models/characters/CharacterCondition'
import {
  getCharacterConditions,
  withCharacterConditions,
} from '../../models/characters/characterConditionStorage'
import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type {
  CustomAbilityActivationDefinition,
  CustomAbilityConditionChangeDefinition,
  CustomAbilityResourceChangeDefinition,
  CustomPredefinedAbilityDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomResourceState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import { evaluateCustomFormula } from './CustomFormulaEngineWithCharacter'
import { getCustomAbilityAvailability } from './CustomAbilityManagement'

export function activateCustomAbility(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  sourceSystemId: string,
  abilityId: string,
): CharacterTemplate {
  const originalStates = (character.get('sheet').customSystems ?? []) as CharacterCustomSystemState[]
  const states = originalStates.map(cloneState)
  const sourceState = requireState(states, sourceSystemId)
  const sourceDefinition = requireDefinition(definitions, sourceSystemId)
  const ability = requireAbility(sourceState, abilityId)
  const type = sourceDefinition.abilityTypes.find((entry) => entry.id === ability.abilityTypeId)
  if (!type) throw new Error(`O tipo da habilidade “${abilityId}” não existe mais.`)

  const preset = type.predefinedAbilities?.find((entry) => entry.id === ability.predefinedAbilityId)
  const effectiveType = preset?.acquisition
    ? { ...type, acquisition: { ...type.acquisition, ...preset.acquisition } }
    : type
  const availability = getCustomAbilityAvailability(effectiveType, ability)
  if (!availability.canUse) {
    throw new Error(availability.learned ? 'A habilidade precisa estar preparada para ser usada.' : 'A habilidade precisa estar aprendida para ser usada.')
  }

  const activation = mergeActivation(type.activation, preset)
  const usage = resolveUsage(activation, sourceDefinition, sourceState, ability, character)
  if (usage.maximum !== undefined && usage.used >= usage.maximum) {
    throw new Error('A habilidade não possui usos restantes.')
  }

  const resolvedChanges = (activation.resourceChanges ?? []).map((change) => ({
    change,
    amount: resolveAmount(change, sourceDefinition, sourceState, character),
  }))

  validateResourceChanges(character, definitions, states, resolvedChanges)

  let nextCharacter = character
  for (const resolved of resolvedChanges) {
    nextCharacter = applyResourceChange(nextCharacter, definitions, states, resolved.change, resolved.amount)
  }

  const abilityName = resolveAbilityName(type, ability, preset)
  for (const conditionChange of activation.conditionChanges ?? []) {
    nextCharacter = applyConditionChange(
      nextCharacter,
      sourceDefinition.name,
      abilityName,
      conditionChange,
    )
  }

  const nextSourceState = requireState(states, sourceSystemId)
  nextSourceState.abilities = nextSourceState.abilities.map((entry) =>
    entry.id === abilityId
      ? {
          ...entry,
          usage: usage.limited
            ? { used: usage.used + 1, maximum: usage.maximum }
            : undefined,
        }
      : entry,
  )

  return nextCharacter.withSheet('customSystems', states)
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
    resourceChanges: preset.activation.resourceChanges ?? base?.resourceChanges,
    conditionChanges: preset.activation.conditionChanges ?? base?.conditionChanges,
  }
}

function resolveUsage(
  activation: CustomAbilityActivationDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  ability: CustomAbilityInstance,
  character: CharacterTemplate,
) {
  const usage = activation.usage
  const limited = Boolean(usage && (usage.mode ?? 'limited') === 'limited')
  if (!limited) return { limited: false, used: 0, maximum: undefined as number | undefined }

  let maximum = ability.usage?.maximum ?? usage?.maximum
  if (usage?.maximumFormula?.trim()) {
    const result = evaluateCustomFormula(usage.maximumFormula, definition, state, character)
    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) {
      maximum = Math.max(0, Math.floor(result.value))
    }
  }

  return {
    limited: true,
    used: ability.usage?.used ?? 0,
    maximum,
  }
}

function resolveAmount(
  change: CustomAbilityResourceChangeDefinition,
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  character: CharacterTemplate,
): number {
  if (change.formula?.trim()) {
    const result = evaluateCustomFormula(change.formula, definition, state, character)
    if (!result.ok || typeof result.value !== 'number' || !Number.isFinite(result.value)) {
      throw new Error(`A fórmula do efeito de recurso “${change.id}” não retornou um número válido.`)
    }
    return Math.max(0, result.value)
  }
  return Math.max(0, change.amount ?? 0)
}

function validateResourceChanges(
  character: CharacterTemplate,
  definitions: CustomSystemDefinition[],
  states: CharacterCustomSystemState[],
  changes: Array<{ change: CustomAbilityResourceChangeDefinition; amount: number }>,
) {
  for (const { change, amount } of changes) {
    if (change.operation !== 'spend') continue
    if (change.target.source === 'native') {
      const available = nativeResourceValue(character, change.target.resource)
      if (available < amount && change.target.resource !== 'hitPoints') {
        throw new Error('Recurso nativo insuficiente para usar a habilidade.')
      }
      continue
    }

    const state = requireState(states, change.target.systemId)
    const definition = requireDefinition(definitions, change.target.systemId)
    const resource = definition.resources.find((entry) => entry.id === change.target.resourceId)
    const resourceState = state.resources[change.target.resourceId]
    if (!resource || !resourceState) throw new Error(`O recurso “${change.target.resourceId}” não está disponível.`)
    const minimum = resource.minimum ?? 0
    if (resourceState.current - amount < minimum) {
      throw new Error(`Não há ${resource.name} suficiente para usar a habilidade.`)
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
  if (change.target.source === 'native') {
    return applyNativeChange(character, change.target.resource, change.operation, amount)
  }

  const state = requireState(states, change.target.systemId)
  const definition = requireDefinition(definitions, change.target.systemId)
  const resource = definition.resources.find((entry) => entry.id === change.target.resourceId)
  const current = state.resources[change.target.resourceId]
  if (!resource || !current) throw new Error(`O recurso “${change.target.resourceId}” não está disponível.`)

  const raw = operationValue(current.current, change.operation, amount)
  const maximum = current.maximum ?? resource.maximum
  const next = clamp(raw, resource.minimum, maximum)
  state.resources[change.target.resourceId] = { ...current, current: next }
  return character
}

function applyConditionChange(
  character: CharacterTemplate,
  source: string,
  abilityName: string,
  change: CustomAbilityConditionChangeDefinition,
): CharacterTemplate {
  const name = change.name.trim()
  if (!name) return character

  const normalizedName = normalize(name)
  const conditions = getCharacterConditions(character)

  if (change.operation === 'remove') {
    return withCharacterConditions(
      character,
      conditions.filter((condition) => normalize(condition.name) !== normalizedName),
    )
  }

  const condition: CharacterCondition = {
    id: crypto.randomUUID(),
    name,
    description: change.description?.trim() ?? '',
    behavior: change.behavior?.trim() ?? '',
    source,
    notes: `Aplicada pela habilidade ${abilityName}.`,
    tags: change.tags?.filter(Boolean) ?? [],
    duration: buildDuration(change.duration),
    createdAt: new Date().toISOString(),
  }

  return withCharacterConditions(character, [
    ...conditions.filter(
      (existing) => !(
        normalize(existing.name) === normalizedName &&
        normalize(existing.source) === normalize(source)
      ),
    ),
    condition,
  ])
}

function resolveAbilityName(type: any, ability: CustomAbilityInstance, preset?: CustomPredefinedAbilityDefinition): string {
  const title = ability.values[type.display.titleFieldId]
  if (typeof title === 'string' && title.trim()) return title.trim()
  return preset?.id || type.name
}

function buildDuration(
  duration: CustomAbilityConditionChangeDefinition['duration'],
): CharacterCondition['duration'] {
  const type: ConditionDurationType = duration?.type ?? 'permanent'
  const numeric = isNumericDuration(type)
  const amount = numeric ? Math.max(0, duration?.amount ?? 1) : undefined
  return {
    type,
    total: amount,
    remaining: amount,
    customLabel: type === 'custom' ? duration?.customLabel : undefined,
    autoRemoveAtZero: duration?.autoRemoveAtZero ?? true,
  }
}

function isNumericDuration(type: ConditionDurationType) {
  return type === 'rounds' || type === 'turns' || type === 'minutes' || type === 'hours' || type === 'days'
}

function applyNativeChange(
  character: CharacterTemplate,
  resource: 'hitPoints' | 'temporaryHitPoints' | 'inspiration' | 'exhaustion',
  operation: 'spend' | 'gain' | 'set',
  amount: number,
): CharacterTemplate {
  if (resource === 'hitPoints') {
    if (operation === 'spend') return character.takeDamage(amount)
    if (operation === 'gain') return character.heal(amount)
    return character.setCurrentHp(amount)
  }

  if (resource === 'temporaryHitPoints') {
    const current = character.get('sheet').HP.temporary ?? 0
    if (operation === 'gain') return character.addTemporaryHp(amount)
    return character.setTemporaryHp(Math.max(0, operation === 'set' ? amount : current - amount))
  }

  if (resource === 'inspiration') {
    const next = operation === 'spend' ? false : operation === 'gain' ? true : amount > 0
    return character.withStat('inspiration', next)
  }

  const current = character.get('sheet').stats.exhaustion ?? 0
  return character.withStat('exhaustion', clamp(operationValue(current, operation, amount), 0, 6))
}

function nativeResourceValue(
  character: CharacterTemplate,
  resource: 'hitPoints' | 'temporaryHitPoints' | 'inspiration' | 'exhaustion',
): number {
  if (resource === 'hitPoints') return character.get('sheet').HP.current
  if (resource === 'temporaryHitPoints') return character.get('sheet').HP.temporary ?? 0
  if (resource === 'inspiration') return character.get('sheet').stats.inspiration ? 1 : 0
  return character.get('sheet').stats.exhaustion ?? 0
}

function operationValue(current: number, operation: 'spend' | 'gain' | 'set', amount: number) {
  if (operation === 'spend') return current - amount
  if (operation === 'gain') return current + amount
  return amount
}

function clamp(value: number, minimum?: number, maximum?: number) {
  const lower = minimum === undefined ? value : Math.max(minimum, value)
  return maximum === undefined ? lower : Math.min(maximum, lower)
}

function requireState(states: CharacterCustomSystemState[], systemId: string) {
  const state = states.find((entry) => entry.systemId === systemId)
  if (!state) throw new Error(`O sistema “${systemId}” não está instalado neste personagem.`)
  return state
}

function requireDefinition(definitions: CustomSystemDefinition[], systemId: string) {
  const definition = definitions.find((entry) => entry.id === systemId)
  if (!definition) throw new Error(`A definição do sistema “${systemId}” não está disponível.`)
  return definition
}

function requireAbility(state: CharacterCustomSystemState, abilityId: string) {
  const ability = state.abilities.find((entry) => entry.id === abilityId)
  if (!ability) throw new Error(`A habilidade “${abilityId}” não está disponível.`)
  return ability
}

function cloneState(state: CharacterCustomSystemState): CharacterCustomSystemState {
  return {
    ...state,
    fields: { ...state.fields },
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([id, resource]) => [id, { ...resource } satisfies CustomResourceState]),
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}
