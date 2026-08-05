import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import type { ClassName } from "../sheet/Class"
import {
  getExpandedClassProgression,
  getExpandedFeaturesAtLevel,
} from "./ExpandedClassProgression"
import { getProgressionChoiceDescription } from "./ProgressionChoiceDescriptions"

const SUBCLASS_MARKER_NAMES: Record<ClassName, string[]> = {
  artificer: ["Especialidade de Artífice", "Especialidade do Artífice"],
  barbarian: ["Caminho Primitivo"],
  bard: ["Colégio de Bardo", "Colégio Bárdico"],
  cleric: ["Domínio Divino"],
  druid: ["Círculo Druídico"],
  fighter: ["Arquetipo Marcial", "Arquétipo Marcial"],
  monk: ["Tradição Monástica"],
  paladin: ["Juramento Sagrado"],
  ranger: ["Arquétipo de Patrulheiro", "Conclave de Patrulheiro"],
  rogue: ["Arquétipo Ladino"],
  sorcerer: ["Origem Feiticeira"],
  warlock: ["Patrono Transcendental", "Patrono de Outro Mundo"],
  wizard: ["Tradição Arcana"],
}

export function materializeProgressionChoices(
  character: CharacterTemplate,
): CharacterTemplate {
  const abilities = [...(character.get("abilities") ?? [])]
  const replacements = new Map<string, Ability[]>()
  const subclassRenames = new Map<string, { name: string; description: string }>()

  for (const classEntry of character.get("sheet").classes ?? []) {
    const progression = getExpandedClassProgression(classEntry.className)
    const subclass = progression.subclasses.find(
      (entry) => entry.id === classEntry.subclass?.id,
    )

    if (subclass) {
      for (const marker of SUBCLASS_MARKER_NAMES[classEntry.className]) {
        subclassRenames.set(normalize(marker), {
          name: subclass.name,
          description: `Subclasse de ${progression.label}: ${subclass.name}. Fonte: ${subclass.source}.`,
        })
      }
    }

    for (let level = 1; level <= classEntry.level; level += 1) {
      for (const feature of getExpandedFeaturesAtLevel(
        classEntry.className,
        level,
        classEntry.subclass?.id,
      )) {
        if (!feature.choice || feature.choice.kind === "asi" || feature.choice.kind === "metamagic") {
          continue
        }
        const selected = classEntry.levelChoices?.[feature.choice.id] ?? []
        if (!selected.length) continue

        const abilityId = `progression:${classEntry.className}:${classEntry.subclass?.id ?? "base"}:${feature.id}`
        const base = abilities.find((ability) => ability.id === abilityId)
        if (!base) continue

        replacements.set(
          abilityId,
          selected.map((option, index) => ({
            ...base,
            id: `${abilityId}:choice:${slug(option)}:${index}`,
            name: option,
            description: [
              `${feature.name}: ${option}.`,
              getProgressionChoiceDescription(option, feature.choice?.label),
              feature.description,
            ]
              .filter(Boolean)
              .join("\n\n"),
            originalAbilityId: abilityId,
            acquisition: base.acquisition
              ? {
                  ...base.acquisition,
                  sourceId: `${base.acquisition.sourceId ?? abilityId}:${slug(option)}`,
                  sourceName: option,
                }
              : undefined,
          })),
        )
      }
    }
  }

  const next: Ability[] = []
  for (const ability of abilities) {
    const choiceAbilities = replacements.get(ability.id)
    if (choiceAbilities) {
      next.push(...choiceAbilities)
      continue
    }

    const subclass = subclassRenames.get(normalize(ability.name))
    if (subclass) {
      next.push({
        ...ability,
        name: subclass.name,
        description: subclass.description,
      })
      continue
    }

    next.push(ability)
  }

  return character.with("abilities", deduplicate(next))
}

function deduplicate(abilities: Ability[]): Ability[] {
  const seen = new Set<string>()
  return abilities.filter((ability) => {
    if (seen.has(ability.id)) return false
    seen.add(ability.id)
    return true
  })
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function slug(value: string): string {
  return normalize(value).replace(/\s+/g, "-") || "choice"
}
