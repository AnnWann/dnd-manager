import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type {
  CustomAbilityAcquisitionDefinition,
  CustomAbilityTypeDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type {
  CharacterCustomSystemState,
  CustomAbilityInstance,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import { evaluateCustomFormula } from './CustomFormulaEngineWithCharacter'

export type CustomAbilityAvailability = {
  learned: boolean
  prepared: boolean
  canUse: boolean
  mode: CustomAbilityAcquisitionDefinition['mode']
}

export function initializeCustomAbilityProgress(
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
): CustomAbilityInstance {
  const acquisition = normalizeAcquisition(type.acquisition)
  const learned = acquisition.mode === 'granted'
    || acquisition.mode === 'prepared'
    || acquisition.defaultLearned !== false
  const prepared = acquisition.mode === 'granted'
    || acquisition.mode === 'learned'
    || Boolean(acquisition.defaultPrepared)

  return {
    ...ability,
    learned,
    prepared: learned ? prepared : false,
  }
}

export function getCustomAbilityAvailability(
  type: CustomAbilityTypeDefinition,
  ability: CustomAbilityInstance,
): CustomAbilityAvailability {
  const acquisition = normalizeAcquisition(type.acquisition)
  const learned = acquisition.mode === 'granted'
    || acquisition.mode === 'prepared'
    || ability.learned !== false
  const prepared = acquisition.mode === 'granted'
    || acquisition.mode === 'learned'
    || ability.prepared === true

  return {
    learned,
    prepared,
    canUse: learned && prepared && ability.enabled !== false,
    mode: acquisition.mode,
  }
}

export function setCustomAbilityLearned(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  learned: boolean,
  character?: CharacterTemplate,
): CharacterCustomSystemState {
  const ability = requireAbility(state, abilityId)
  const type = requireType(definition, ability.abilityTypeId)
  const acquisition = normalizeAcquisition(type.acquisition)

  if (acquisition.mode === 'granted' || acquisition.mode === 'prepared') return state
  if (learned) {
    assertLimit(definition, state, type, 'learned', character)
  }

  return replaceAbility(state, abilityId, {
    ...ability,
    learned,
    prepared: learned ? ability.prepared : false,
  })
}

export function setCustomAbilityPrepared(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  abilityId: string,
  prepared: boolean,
  character?: CharacterTemplate,
): CharacterCustomSystemState {
  const ability = requireAbility(state, abilityId)
  const type = requireType(definition, ability.abilityTypeId)
  const acquisition = normalizeAcquisition(type.acquisition)
  const availability = getCustomAbilityAvailability(type, ability)

  if (acquisition.mode === 'granted' || acquisition.mode === 'learned') return state
  if (!availability.learned) throw new Error('A habilidade precisa ser aprendida antes de ser preparada.')
  if (prepared) {
    assertLimit(definition, state, type, 'prepared', character)
  }

  return replaceAbility(state, abilityId, { ...ability, prepared })
}

export function getCustomAbilityLimit(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: CustomAbilityTypeDefinition,
  kind: 'learned' | 'prepared',
  character?: CharacterTemplate,
): number | undefined {
  const acquisition = normalizeAcquisition(type.acquisition)
  const fixed = kind === 'learned' ? acquisition.learnedLimit : acquisition.preparedLimit
  const formula = kind === 'learned' ? acquisition.learnedLimitFormula : acquisition.preparedLimitFormula
  if (!formula?.trim()) return fixed

  const result = evaluateCustomFormula(formula, definition, state, character)
  if (!result.ok || typeof result.value !== 'number' || !Number.isFinite(result.value)) return fixed
  return Math.max(0, Math.floor(result.value))
}

export function countCustomAbilities(
  state: CharacterCustomSystemState,
  typeId: string,
  kind: 'learned' | 'prepared',
): number {
  return state.abilities.filter((ability) => {
    if (ability.abilityTypeId !== typeId) return false
    return kind === 'learned' ? ability.learned !== false : ability.prepared === true
  }).length
}

function assertLimit(
  definition: CustomSystemDefinition,
  state: CharacterCustomSystemState,
  type: CustomAbilityTypeDefinition,
  kind: 'learned' | 'prepared',
  character?: CharacterTemplate,
) {
  const limit = getCustomAbilityLimit(definition, state, type, kind, character)
  if (limit === undefined) return
  const current = countCustomAbilities(state, type.id, kind)
  if (current >= limit) {
    throw new Error(`O limite de habilidades ${kind === 'learned' ? 'aprendidas' : 'preparadas'} para “${type.name}” é ${limit}.`)
  }
}

function normalizeAcquisition(value?: CustomAbilityAcquisitionDefinition): CustomAbilityAcquisitionDefinition {
  return value ?? {
    mode: 'learned',
    defaultLearned: true,
    defaultPrepared: false,
    preparationReset: 'manual',
  }
}

function requireAbility(state: CharacterCustomSystemState, abilityId: string) {
  const ability = state.abilities.find((entry) => entry.id === abilityId)
  if (!ability) throw new Error(`Habilidade “${abilityId}” não encontrada.`)
  return ability
}

function requireType(definition: CustomSystemDefinition, typeId: string) {
  const type = definition.abilityTypes.find((entry) => entry.id === typeId)
  if (!type) throw new Error(`Tipo de habilidade “${typeId}” não encontrado.`)
  return type
}

function replaceAbility(
  state: CharacterCustomSystemState,
  abilityId: string,
  next: CustomAbilityInstance,
): CharacterCustomSystemState {
  return {
    ...state,
    abilities: state.abilities.map((entry) => entry.id === abilityId ? next : entry),
  }
}
