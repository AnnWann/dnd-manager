import type { Spell } from "../magic/spells/Spell"
import type { CharacterCondition } from "./CharacterCondition"
import type { CharacterTemplate } from "./CharacterTemplate"
import {
  addCharacterCondition,
  getCharacterConditions,
  removeCharacterCondition,
} from "./characterConditionStorage"

export const CONCENTRATION_CONDITION_TAG = "dnd-manager:concentrating"

export function getConcentrationCondition(
  character: CharacterTemplate,
): CharacterCondition | undefined {
  return getCharacterConditions(character).find(isConcentrationCondition)
}

export function isCharacterConcentrating(character: CharacterTemplate): boolean {
  return Boolean(getConcentrationCondition(character))
}

export function beginSpellConcentration(
  character: CharacterTemplate,
  spell: Spell,
): CharacterTemplate {
  let next = endConcentration(character)
  const name = spell.displayName || spell.name

  return addCharacterCondition(next, {
    id: `concentration:${crypto.randomUUID()}`,
    name: "Concentrando",
    description: `Mantendo concentração em ${name}.`,
    behavior: "A concentração termina ao falhar em um teste de concentração, ao iniciar outra concentração ou quando o efeito for encerrado.",
    source: name,
    notes: `spell:${spell.index}`,
    tags: [CONCENTRATION_CONDITION_TAG, "magia", "concentração"],
    duration: {
      type: "concentration",
      autoRemoveAtZero: false,
      customLabel: `Concentrando em ${name}`,
    },
    createdAt: new Date().toISOString(),
  })
}

export function endConcentration(character: CharacterTemplate): CharacterTemplate {
  const condition = getConcentrationCondition(character)
  return condition
    ? removeCharacterCondition(character, condition.id)
    : character
}

export function getConcentrationSpellName(
  character: CharacterTemplate,
): string | undefined {
  return getConcentrationCondition(character)?.source || undefined
}

function isConcentrationCondition(condition: CharacterCondition): boolean {
  if (condition.tags.includes(CONCENTRATION_CONDITION_TAG)) return true
  return normalize(condition.name) === "concentrando"
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
