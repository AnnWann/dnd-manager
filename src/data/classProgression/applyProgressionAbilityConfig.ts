import type { Ability } from "../../models/abilities/Ability"
import { createCharacterAcquisition } from "../../models/characters/CharacterAcquisition"
import type { ClassName } from "../../models/sheet/Class"
import {
  applyProgressionAbilityTemplate,
  type ProgressionAbilityConfig,
} from "./ability"
import { getClassProgression } from "./registry"
import type { LevelFeatureDefinition } from "./types"

const CLASS_NAMES: readonly ClassName[] = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]

/**
 * Refreshes content and mechanics from the canonical class/subclass feature.
 * Identity, acquisition and mutable state remain character-owned.
 */
export function applyProgressionAbilityConfig(ability: Ability): Ability {
  const feature = getProgressionFeatureDefinition(ability)
  if (!feature) return ability

  const isChoiceProjection = Boolean(
    ability.originalAbilityId && ability.originalAbilityId !== ability.id,
  )
  const sourcedAbility: Ability = {
    ...ability,
    name: isChoiceProjection ? ability.name : feature.name,
    description: isChoiceProjection
      ? ability.description
      : feature.description?.trim() || ability.description,
  }
  const configured = applyProgressionAbilityTemplate(
    sourcedAbility,
    feature.ability,
    { preserveContent: isChoiceProjection },
  )

  return withGrantedSpellAcquisition(configured)
}

export function getProgressionFeatureDefinition(
  ability: Ability,
): LevelFeatureDefinition | undefined {
  const sourceAbilityId = ability.originalAbilityId ?? ability.id
  const parsed = parseProgressionAbilityId(sourceAbilityId)
  if (!parsed) return undefined

  const progression = getClassProgression(parsed.className)
  return parsed.subclassId === "base"
    ? progression.features.find((entry) => entry.id === parsed.featureId)
    : progression.subclasses
        .find((entry) => entry.id === parsed.subclassId)
        ?.features.find((entry) => entry.id === parsed.featureId)
}

export function getProgressionAbilityConfig(
  ability: Ability,
): ProgressionAbilityConfig | undefined {
  return getProgressionFeatureDefinition(ability)?.ability
}

export function hasProgressionAbilityConfig(ability: Ability): boolean {
  return Boolean(getProgressionAbilityConfig(ability))
}

function withGrantedSpellAcquisition(ability: Ability): Ability {
  if (!ability.grantedSpells?.length || !ability.acquisition) return ability

  return {
    ...ability,
    grantedSpells: ability.grantedSpells.map((grant) => ({
      ...grant,
      acquisition:
        grant.acquisition ??
        createCharacterAcquisition({
...ability.acquisition!,
sourceType: "ability",
sourceId: ability.id,
sourceName: ability.name,
        }),
    })),
  }
}

function parseProgressionAbilityId(value: string): {
  className: ClassName
  subclassId: string
  featureId: string
} | undefined {
  const [prefix, rawClassName, subclassId, ...featureParts] = value.split(":")
  if (
    prefix !== "progression" ||
    !isClassName(rawClassName) ||
    !subclassId ||
    !featureParts.length
  ) {
    return undefined
  }

  return {
    className: rawClassName,
    subclassId,
    featureId: featureParts.join(":"),
  }
}

function isClassName(value: string): value is ClassName {
  return CLASS_NAMES.includes(value as ClassName)
}
