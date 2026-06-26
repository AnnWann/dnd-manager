import type { Ability } from "../abilities/Ability"
import { applyAbilityDefault } from "../abilities/AbilityDefaults"
import type { CharacterTemplate } from "../characters/CharacterTemplate"
import { synchronizeSorceryPointPool } from "../characters/characterSorceryPoints"
import type { ClassName } from "../sheet/Class"
import {
  getFeaturesAtLevel,
  type LevelFeatureDefinition,
} from "./ClassProgression"
import { getClassNamePt } from "./ClassLocalization"
import { getFeatureNamePt } from "./FeatureLocalization"

const SOURCE_VERSION = 1

/**
 * Adds deterministic class-feature abilities that are missing from old
 * characters. Existing abilities are never replaced; they are only tagged
 * with their source metadata so later template updates can preserve edits.
 */
export function synchronizeClassFeatures(
  character: CharacterTemplate,
): CharacterTemplate {
  let abilities = [...(character.get("abilities") ?? [])]

  for (const characterClass of character.get("sheet").classes ?? []) {
    const className = characterClass.className
    const subclassId = characterClass.subclass?.id

    for (let level = 1; level <= Number(characterClass.level); level += 1) {
      const features = getFeaturesAtLevel(className, level, subclassId)

      for (const feature of features) {
        const generated = createFeatureAbility(
          className,
          level,
          feature,
          feature.choice
            ? characterClass.levelChoices?.[feature.choice.id] ?? []
            : [],
        )
        const savedChoice = feature.choice
          ? characterClass.levelChoices?.[feature.choice.id] ?? []
          : []
        const existingIndex = findExistingAbilityIndex(
          abilities,
          generated,
        )

        if (feature.optional && existingIndex < 0 && savedChoice.length === 0) {
          continue
        }

        if (existingIndex >= 0) {
          const existing = abilities[existingIndex]
          abilities[existingIndex] = applyAbilityDefault({
            ...existing,
            sourceAbilityId:
              existing.sourceAbilityId ?? generated.sourceAbilityId,
            sourceVersion:
              existing.sourceVersion ?? generated.sourceVersion,
          })
        } else {
          abilities.push(applyAbilityDefault(generated))
        }

        if (!feature.choice || feature.choice.kind === "asi") continue

        for (const selected of savedChoice) {
          const selectedId = choiceAbilityId(
            className,
            feature.choice.id,
            selected,
          )
          const existingChoiceIndex = abilities.findIndex(
            (ability) =>
              ability.id === selectedId ||
              (!ability.sourceAbilityId &&
                normalize(ability.name) === normalize(selected)),
          )

          if (existingChoiceIndex >= 0) {
            const existing = abilities[existingChoiceIndex]
            abilities[existingChoiceIndex] = applyAbilityDefault({
              ...existing,
              sourceAbilityId:
                existing.sourceAbilityId ??
                `class-choice:${className}:${feature.choice.id}:${slug(selected)}`,
              sourceVersion: existing.sourceVersion ?? SOURCE_VERSION,
            })
            continue
          }

          abilities.push(
            applyAbilityDefault({
              id: selectedId,
              name: selected,
              description: `${feature.choice.label}. Escolha registrada em ${getClassNamePt(className)} no nível ${level}.`,
              kind: "passive",
              category:
                feature.choice.kind === "invocation"
                  ? "invocation"
                  : "general",
              sourceAbilityId: `class-choice:${className}:${feature.choice.id}:${slug(selected)}`,
              sourceVersion: SOURCE_VERSION,
            }),
          )
        }
      }
    }
  }

  let next = character.with("abilities", abilities)
  next = next.ensureMagic().syncMagicWithClasses()
  next = synchronizeSorceryPointPool(next)
  return next
}

function findExistingAbilityIndex(
  abilities: Ability[],
  generated: Ability,
): number {
  const byId = abilities.findIndex((ability) => ability.id === generated.id)
  if (byId >= 0) return byId

  return abilities.findIndex(
    (ability) =>
      !ability.sourceAbilityId &&
      normalize(ability.name) === normalize(generated.name),
  )
}

function createFeatureAbility(
  className: ClassName,
  level: number,
  feature: LevelFeatureDefinition,
  selectedValues: string[],
): Ability {
  const description = [
    `${getClassNamePt(className)} nível ${level}.`,
    `Fonte: ${feature.source}.`,
    feature.optional ? "Característica opcional selecionada." : "",
    selectedValues.length
      ? `Escolha: ${selectedValues.join(", ")}.`
      : "",
    feature.description ?? "",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    id: featureAbilityId(className, level, feature.id),
    name: getFeatureNamePt(feature.name),
    description,
    kind: "passive",
    category:
      feature.choice?.kind === "invocation" ? "invocation" : "general",
    sourceAbilityId: `class-feature:${className}:${feature.id}`,
    sourceVersion: SOURCE_VERSION,
  }
}

export function featureAbilityId(
  className: ClassName,
  level: number,
  featureId: string,
): string {
  return `level:${className}:${level}:${featureId}`
}

export function choiceAbilityId(
  className: ClassName,
  choiceId: string,
  value: string,
): string {
  return `choice:${className}:${choiceId}:${slug(value)}`
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function slug(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
