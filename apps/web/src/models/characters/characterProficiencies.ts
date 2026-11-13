import { meetsUnlockRequirements } from "../magic/spells/grantedSpellUnlocks"
import { getCharacterAsis } from "./CharacterAsi"
import { resolveSkill } from "./applyManualProficiencies"
import type { Skill, SkillProficiency } from "../sheet/Skills"
import type { CharacterTemplate } from "./CharacterTemplate"
import type {
  Proficiency,
  ProficiencyCategory,
} from "../sheet/Proficiency"
import { getEquippedItems } from "./characterEquipment"
import { isAbilityBenefitsActive } from "../abilities/abilityActivation"

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
  const skill = category === "skill" ? resolveSkill(name) : undefined

  return getCharacterProficiencies(character).some(
    (proficiency) =>
      proficiency.category === category &&
      (skill ? resolveSkill(proficiency.name) === skill : normalizeProficiencyName(proficiency.name) === normalizedName),
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
    ...getCharacterAsis(character).flatMap(({ ability }) => ability ? [ability] : []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap((item) => item.abilities ?? []),
  ].filter((ability) => isAbilityBenefitsActive(ability) && meetsUnlockRequirements(character, ability.unlockRequirements))

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
  const proficiencies = [
    ...(character.get("sheet").proficiencies ?? []),
    ...(character.get("sheet").race.proficiencies ?? []),
    ...getAbilityGrantedProficiencies(character).map(
      (entry) => entry.proficiency,
    ),
  ]
  const strongest = new Map<string, Proficiency>()

  for (const proficiency of proficiencies) {
    const skill = proficiency.category === "skill" ? resolveSkill(proficiency.name) : undefined
    const key = `${proficiency.category}:${skill ?? normalizeProficiencyName(proficiency.name)}`
    const existing = strongest.get(key)
    if (!existing || (skill && proficiency.expertise && !existing.expertise)) {
      strongest.set(key, proficiency)
    }
  }
  return Array.from(strongest.values())
}

export function getEffectiveSkillProficiency(character: CharacterTemplate, skill: Skill): SkillProficiency {
  const base = character.get("sheet").skills[skill] ?? "none"
  if (base === "expertise") return base
  const grant = getCharacterProficiencies(character).find(
    proficiency => proficiency.category === "skill" && resolveSkill(proficiency.name) === skill,
  )
  return grant?.expertise ? "expertise" : grant ? "proficient" : base
}

function normalizeProficiencyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}

export function setManualSkillProficiency(
  character: CharacterTemplate,
  skill: Skill,
  proficiency: SkillProficiency,
): CharacterTemplate {
  const sheet = character.get("sheet")
  const proficiencies = (sheet.proficiencies ?? []).flatMap(entry => {
    if (entry.category !== "skill" || resolveSkill(entry.name) !== skill) return [entry]
    return proficiency === "none" ? [] : [{ ...entry, expertise: proficiency === "expertise" }]
  })
  return character.withPatch({
    sheet: { ...sheet, skills: { ...sheet.skills, [skill]: proficiency }, proficiencies },
  })
}
