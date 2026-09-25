import type { Attribute } from "../sheet/Attribute"
import type { Skill } from "../sheet/Skills"
import type { CreatureAbilityScores } from "./CompendiumCreature"

export const CREATURE_ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "FOR",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
}

export type ParsedCreatureSave = {
  attribute: Attribute
  label: string
  bonus: number
}

export type ParsedCreatureSkill = {
  skill: Skill
  label: string
  attribute: Attribute
  bonus: number
}

const SKILLS: Array<{
  skill: Skill
  label: string
  attribute: Attribute
  aliases: string[]
}> = [
  { skill: "acrobatics", label: "Acrobacia", attribute: "dex", aliases: ["acrobatics", "acrobacia"] },
  { skill: "animalHandling", label: "Adestrar Animais", attribute: "wis", aliases: ["animal handling", "adestrar animais", "lidar com animais"] },
  { skill: "arcana", label: "Arcanismo", attribute: "int", aliases: ["arcana", "arcanismo"] },
  { skill: "athletics", label: "Atletismo", attribute: "str", aliases: ["athletics", "atletismo"] },
  { skill: "deception", label: "Enganação", attribute: "cha", aliases: ["deception", "enganacao", "enganação"] },
  { skill: "history", label: "História", attribute: "int", aliases: ["history", "historia", "história"] },
  { skill: "insight", label: "Intuição", attribute: "wis", aliases: ["insight", "intuicao", "intuição"] },
  { skill: "intimidation", label: "Intimidação", attribute: "cha", aliases: ["intimidation", "intimidacao", "intimidação"] },
  { skill: "investigation", label: "Investigação", attribute: "int", aliases: ["investigation", "investigacao", "investigação"] },
  { skill: "medicine", label: "Medicina", attribute: "wis", aliases: ["medicine", "medicina"] },
  { skill: "nature", label: "Natureza", attribute: "int", aliases: ["nature", "natureza"] },
  { skill: "perception", label: "Percepção", attribute: "wis", aliases: ["perception", "percepcao", "percepção"] },
  { skill: "performance", label: "Atuação", attribute: "cha", aliases: ["performance", "atuacao", "atuação"] },
  { skill: "persuasion", label: "Persuasão", attribute: "cha", aliases: ["persuasion", "persuasao", "persuasão"] },
  { skill: "religion", label: "Religião", attribute: "int", aliases: ["religion", "religiao", "religião"] },
  { skill: "sleightOfHand", label: "Prestidigitação", attribute: "dex", aliases: ["sleight of hand", "prestidigitacao", "prestidigitação", "destreza manual"] },
  { skill: "stealth", label: "Furtividade", attribute: "dex", aliases: ["stealth", "furtividade"] },
  { skill: "survival", label: "Sobrevivência", attribute: "wis", aliases: ["survival", "sobrevivencia", "sobrevivência"] },
]

const ATTRIBUTE_ALIASES: Array<{ attribute: Attribute; aliases: string[] }> = [
  { attribute: "str", aliases: ["str", "for", "strength", "forca", "força"] },
  { attribute: "dex", aliases: ["dex", "des", "dexterity", "destreza"] },
  { attribute: "con", aliases: ["con", "constitution", "constituicao", "constituição"] },
  { attribute: "int", aliases: ["int", "intelligence", "inteligencia", "inteligência"] },
  { attribute: "wis", aliases: ["wis", "sab", "wisdom", "sabedoria"] },
  { attribute: "cha", aliases: ["cha", "car", "charisma", "carisma"] },
]

export function creatureAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function parseCreatureSavingThrows(text: string | undefined): ParsedCreatureSave[] {
  return parseSignedEntries(text).flatMap(({ name, bonus }) => {
    const normalized = normalizeName(name)
    const definition = ATTRIBUTE_ALIASES.find((entry) =>
      entry.aliases.some((alias) => normalizeName(alias) === normalized),
    )
    return definition
      ? [{
          attribute: definition.attribute,
          label: CREATURE_ATTRIBUTE_LABELS[definition.attribute],
          bonus,
        }]
      : []
  })
}

export function parseCreatureSkills(text: string | undefined): ParsedCreatureSkill[] {
  return parseSignedEntries(text).flatMap(({ name, bonus }) => {
    const normalized = normalizeName(name)
    const definition = SKILLS.find((entry) =>
      entry.aliases.some((alias) => normalizeName(alias) === normalized),
    )
    return definition
      ? [{
          skill: definition.skill,
          label: definition.label,
          attribute: definition.attribute,
          bonus,
        }]
      : []
  })
}

export function findCreatureSkill(
  text: string | undefined,
  skill: string,
): ParsedCreatureSkill | undefined {
  return parseCreatureSkills(text).find((entry) => entry.skill === skill)
}

export function findCreatureSave(
  text: string | undefined,
  attribute: Attribute,
): ParsedCreatureSave | undefined {
  return parseCreatureSavingThrows(text).find((entry) => entry.attribute === attribute)
}

export type ParsedCreatureDamageFormula = {
  dice: Array<{ quantity: number; sides: number }>
  modifier: number
}

export function parseCreatureDamageFormula(
  formula: string,
): ParsedCreatureDamageFormula | undefined {
  const compact = formula.trim().toLowerCase().replace(/\s+/g, "")
  if (!compact) return undefined

  const dice: Array<{ quantity: number; sides: number }> = []
  let modifier = 0
  let position = 0
  const token = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gy

  while (position < compact.length) {
    token.lastIndex = position
    const match = token.exec(compact)
    if (!match || match.index !== position) return undefined

    const sign = match[1] ?? ""
    if (position > 0 && sign !== "+" && sign !== "-") return undefined

    const quantityText = match[2]
    const sidesText = match[3]
    const integerText = match[4]

    if (sidesText !== undefined) {
      if (sign === "-") return undefined
      const quantity = quantityText ? Number(quantityText) : 1
      const sides = Number(sidesText)
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100 ||
        !Number.isInteger(sides) ||
        sides < 2 ||
        sides > 1000
      ) return undefined
      dice.push({ quantity, sides })
    } else if (integerText !== undefined) {
      const value = Number(integerText)
      if (!Number.isSafeInteger(value)) return undefined
      modifier += sign === "-" ? -value : value
    }

    position = token.lastIndex
  }

  if (!dice.length && modifier === 0) return undefined
  return { dice, modifier }
}

export function resolveCreatureBaseSkillBonus(
  abilityScores: CreatureAbilityScores,
  parsed: ParsedCreatureSkill,
): number {
  return parsed.bonus - creatureAbilityModifier(abilityScores[parsed.attribute])
}

export function resolveCreatureBaseSaveBonus(
  abilityScores: CreatureAbilityScores,
  parsed: ParsedCreatureSave,
): number {
  return parsed.bonus - creatureAbilityModifier(abilityScores[parsed.attribute])
}

function parseSignedEntries(
  text: string | undefined,
): Array<{ name: string; bonus: number }> {
  if (!text?.trim()) return []
  return text
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .flatMap((entry) => {
      const match = entry.match(/^(.+?)\s*([+-]\s*\d+)$/)
      if (!match) return []
      const bonus = Number(match[2].replace(/\s+/g, ""))
      return Number.isFinite(bonus)
        ? [{ name: match[1].trim(), bonus }]
        : []
    })
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
