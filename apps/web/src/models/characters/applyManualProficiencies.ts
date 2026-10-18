import type { CharacterTemplate } from "./CharacterTemplate"
import type { Proficiency } from "../sheet/Proficiency"
import type { Skill } from "../sheet/Skills"

const SKILL_ALIASES: Record<string, Skill> = {
  acrobatics: "acrobatics",
  acrobacia: "acrobatics",
  arcana: "arcana",
  arcanismo: "arcana",
  athletics: "athletics",
  atletismo: "athletics",
  animalhandling: "animalHandling",
  lidarcomanimais: "animalHandling",
  performance: "performance",
  atuacao: "performance",
  deception: "deception",
  blefe: "deception",
  stealth: "stealth",
  furtividade: "stealth",
  history: "history",
  historia: "history",
  intimidation: "intimidation",
  intimidacao: "intimidation",
  insight: "insight",
  intuicao: "insight",
  investigation: "investigation",
  investigacao: "investigation",
  medicine: "medicine",
  medicina: "medicine",
  nature: "nature",
  natureza: "nature",
  perception: "perception",
  percepcao: "perception",
  persuasion: "persuasion",
  persuasao: "persuasion",
  sleightofhand: "sleightOfHand",
  prestidigitacao: "sleightOfHand",
  religion: "religion",
  religiao: "religion",
  survival: "survival",
  sobrevivencia: "survival",
}

export function applyManualProficiencies(
  character: CharacterTemplate,
  additions: Proficiency[],
): CharacterTemplate {
  if (!additions.length) return character

  const sheet = character.get("sheet")
  const proficiencies = mergeProficiencies(sheet.proficiencies ?? [], additions)
  const skills = { ...sheet.skills }

  for (const proficiency of additions) {
    if (proficiency.category !== "skill") continue
    const skill = resolveSkill(proficiency.name)
    if (!skill) continue

    if (proficiency.expertise) {
      skills[skill] = "expertise"
    } else if ((skills[skill] ?? "none") === "none") {
      skills[skill] = "proficient"
    }
  }

  return character.withPatch({
    sheet: {
      ...sheet,
      proficiencies,
      skills,
    },
  })
}

export function mergeProficiencies(
  current: Proficiency[],
  additions: Proficiency[],
): Proficiency[] {
  const merged = [...current]

  for (const addition of additions) {
    const index = merged.findIndex(
      (entry) =>
        entry.category === addition.category &&
        normalize(entry.name) === normalize(addition.name),
    )

    if (index < 0) {
      merged.push(addition)
      continue
    }

    if (addition.expertise && !merged[index].expertise) {
      merged[index] = {
        ...merged[index],
        ...addition,
        expertise: true,
      }
    }
  }

  return merged
}

function resolveSkill(value: string): Skill | undefined {
  return SKILL_ALIASES[normalize(value).replace(/[^a-z0-9]/g, "")]
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
