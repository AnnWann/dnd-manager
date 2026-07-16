import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type { Proficiency } from '../../models/sheet/Proficiency'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
  CustomSystemInstallationRequirement,
} from '../../models/customSystems/CustomSystemDefinition'
import { createCharacterCustomSystemState } from './CustomSystemState'
import { evaluateCustomFormula } from './CustomFormulaEngineWithCharacter'

export type CustomSystemRequirementResult = {
  matches: boolean
  matched: number
  total: number
  details: Array<{ requirementId: string; matches: boolean; label: string }>
}

export function evaluateAutomaticInstallation(
  definition: CustomSystemDefinition,
  character: CharacterTemplate,
): CustomSystemRequirementResult {
  const config = definition.automaticInstallation
  if (!config?.enabled || config.requirements.length === 0) {
    return { matches: false, matched: 0, total: config?.requirements.length ?? 0, details: [] }
  }

  const details = config.requirements.map((requirement) => ({
    requirementId: requirement.id,
    matches: evaluateRequirement(requirement, definition, character),
    label: describeRequirement(requirement),
  }))
  const matched = details.filter((entry) => entry.matches).length
  const matches = config.match === 'any'
    ? matched > 0
    : matched === details.length

  return { matches, matched, total: details.length, details }
}

export function shouldAutomaticallyInstallCustomSystem(
  definition: CustomSystemDefinition,
  character: CharacterTemplate,
): boolean {
  return evaluateAutomaticInstallation(definition, character).matches
}

export function createAutomaticallyInstalledCustomSystemState(
  definition: CustomSystemDefinition,
): CharacterCustomSystemState {
  return {
    ...createCharacterCustomSystemState(definition),
    installationSource: 'automatic',
  }
}

function evaluateRequirement(
  requirement: CustomSystemInstallationRequirement,
  definition: CustomSystemDefinition,
  character: CharacterTemplate,
): boolean {
  if (requirement.type === 'class') {
    const matchingClass = character.get('sheet').classes.find(
      (entry) => entry.className === requirement.className,
    )
    if (!matchingClass) return false
    if ((matchingClass.level ?? 0) < (requirement.minimumLevel ?? 1)) return false
    if (requirement.subclassName?.trim()) {
      return normalize(matchingClass.subclass?.name ?? '') === normalize(requirement.subclassName)
    }
    return true
  }

  if (requirement.type === 'totalLevel') {
    const total = character.get('sheet').classes.reduce((sum, entry) => sum + (entry.level ?? 0), 0)
    return total >= requirement.minimumLevel
  }

  if (requirement.type === 'proficiency') {
    const proficiencies = getAllProficiencies(character)
    return proficiencies.some((proficiency) => {
      if (requirement.proficiencyId?.trim() && proficiency.id !== requirement.proficiencyId) return false
      if (requirement.name?.trim() && normalize(proficiency.name) !== normalize(requirement.name)) return false
      if (requirement.category && proficiency.category !== requirement.category) return false
      return Boolean(requirement.proficiencyId?.trim() || requirement.name?.trim() || requirement.category)
    })
  }

  if (requirement.type === 'ability') {
    const source = requirement.source ?? 'any'
    const standardAbilities = source === 'custom' ? [] : character.getCharacterAbilities()
    const customAbilities = source === 'character'
      ? []
      : (character.get('sheet').customSystems ?? []).flatMap((state) => state.abilities)

    const standardMatch = standardAbilities.some((ability) =>
      matchesIdentity(ability.id, ability.name, requirement.abilityId, requirement.name),
    )
    const customMatch = customAbilities.some((ability) => {
      const system = character.get('sheet').customSystems?.find((state) => state.abilities.some((entry) => entry.id === ability.id))
      const systemDefinition = system?.systemId === definition.id ? definition : undefined
      const type = systemDefinition?.abilityTypes.find((entry) => entry.id === ability.abilityTypeId)
      const titleValue = type ? ability.values[type.display.titleFieldId] : undefined
      const title = typeof titleValue === 'string' ? titleValue : ''
      return matchesIdentity(ability.id, title, requirement.abilityId, requirement.name)
    })
    return standardMatch || customMatch
  }

  if (requirement.type === 'attribute') {
    const value = requirement.useModifier
      ? character.getAttributeModifier(requirement.attribute)
      : character.getEffectiveAttribute(requirement.attribute)
    return value >= requirement.minimumValue
  }

  if (requirement.type === 'formula') {
    try {
      const state = createCharacterCustomSystemState(definition)
      const result = evaluateCustomFormula(requirement.formula, definition, state, character)
      return result.value === true || (typeof result.value === 'number' && result.value !== 0)
    } catch {
      return false
    }
  }

  return false
}

function getAllProficiencies(character: CharacterTemplate): Proficiency[] {
  const sheet = character.get('sheet')
  const combined = [
    ...(sheet.proficiencies ?? []),
    ...(sheet.race?.proficiencies ?? []),
  ]
  const unique = new Map(combined.map((entry) => [entry.id, entry]))
  return [...unique.values()]
}

function matchesIdentity(
  actualId: string,
  actualName: string,
  expectedId?: string,
  expectedName?: string,
): boolean {
  if (expectedId?.trim() && actualId !== expectedId) return false
  if (expectedName?.trim() && normalize(actualName) !== normalize(expectedName)) return false
  return Boolean(expectedId?.trim() || expectedName?.trim())
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function describeRequirement(requirement: CustomSystemInstallationRequirement): string {
  if (requirement.type === 'class') {
    return `${requirement.className} nível ${requirement.minimumLevel ?? 1}${requirement.subclassName ? ` (${requirement.subclassName})` : ''}`
  }
  if (requirement.type === 'totalLevel') return `Nível total ${requirement.minimumLevel}+`
  if (requirement.type === 'proficiency') return requirement.name || requirement.proficiencyId || requirement.category || 'Proficiência'
  if (requirement.type === 'ability') return requirement.name || requirement.abilityId || 'Habilidade'
  if (requirement.type === 'attribute') return `${requirement.attribute.toUpperCase()} ${requirement.minimumValue}+`
  return requirement.formula || 'Fórmula'
}
