import type { CharacterTemplate } from "./CharacterTemplate"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../sheet/Proficiency"

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
  const normalizedName = name.trim().toLocaleLowerCase()

  return (character.get("sheet").proficiencies ?? []).some(
    (proficiency) =>
      proficiency.category === category &&
      proficiency.name.trim().toLocaleLowerCase() === normalizedName,
  )
}