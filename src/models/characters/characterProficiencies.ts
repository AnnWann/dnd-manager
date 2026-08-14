import type { CharacterTemplate } from "./CharacterTemplate"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../sheet/Proficiency"
import { getEquippedItems } from "./characterEquipment"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"
import { getCharacterConditions } from "./characterConditionStorage"

export function addProficiency(
  character: CharacterTemplate,
  proficiency: Proficiency,
): CharacterTemplate {
  return character.withSheet("proficiencies", [
    ...(character.get("sheet").proficiencies ?? []),
    proficiency,
  ])
}

export function updateProficiency(
  character: CharacterTemplate,
  proficiency: Proficiency,
): CharacterTemplate {
  return character.withSheet(
    "proficiencies",
    (character.get("sheet").proficiencies ?? []).map((current) =>
      current.id === proficiency.id ? proficiency : current,
    ),
  )
}

export function removeProficiency(
  character: CharacterTemplate,
  proficiencyId: string,
): CharacterTemplate {
  return character.withSheet(
    "proficiencies",
    (character.get("sheet").proficiencies ?? []).filter(
      (proficiency) => proficiency.id !== proficiencyId,
    ),
  )
}

export function hasProficiency(
  character: CharacterTemplate,
  category: ProficiencyCategory,
  name: string,
): boolean {
  const normalizedName = normalizeProficiencyName(name)

  return getCharacterProficiencies(character).some(
    (proficiency) =>
      proficiency.category === category &&
      normalizeProficiencyName(proficiency.name) === normalizedName,
  )
}

export type AbilityGrantedProficiency = {
  proficiency: Proficiency
  abilityId: string
  abilityName: string
}

export function getAbilityGrantedProficiencies(
  character: CharacterTemplate,
): AbilityGrantedProficiency[] {
  const abilities = [
    ...(character.get("abilities") ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap((item) => item.abilities ?? []),
    ...getCharacterConditions(character).flatMap(
      (condition) => condition.grantedAbilities ?? [],
    ),
  ].filter(isAbilityBenefitsActive)

  return abilities.flatMap((ability) =>
    (ability.grantedProficiencies ?? []).map((proficiency) => ({
      proficiency,
      abilityId: ability.id,
      abilityName: ability.name || "Habilidade sem nome",
    })),
  )
}

export function getCharacterProficiencies(
  character: CharacterTemplate,
): Proficiency[] {
  const conditionProficiencies = getCharacterConditions(character).flatMap(
    (condition) => condition.grantedProficiencies ?? [],
  )
  const proficiencies = [
    ...(character.get("sheet").proficiencies ?? []),
    ...(character.get("sheet").race.proficiencies ?? []),
    ...getAbilityGrantedProficiencies(character).map(
      (entry) => entry.proficiency,
    ),
    ...conditionProficiencies,
  ]
  const seen = new Set<string>()

  return proficiencies.filter((proficiency) => {
    const key = `${proficiency.category}:${normalizeProficiencyName(proficiency.name)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeProficiencyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
