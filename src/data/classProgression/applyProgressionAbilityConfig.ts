import type { Ability } from "../../models/abilities/Ability"
import {
  createCharacterAcquisition,
} from "../../models/characters/CharacterAcquisition"
import type { ProgressionAbilityConfig } from "../../models/leveling/ProgressionAbilityConfig"
import type { ClassName } from "../../models/sheet/Class"
import { getClassProgression } from "./registry"
import type {
  ConfiguredLevelFeatureDefinition,
  LevelFeatureDefinition,
} from "./types"

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
 * Applies the complete Ability template attached to the source progression
 * feature. Identity, acquisition, and consumed-use state remain runtime-owned.
 */
export function applyProgressionAbilityConfig(ability: Ability): Ability {
  const configuration = getProgressionAbilityConfig(ability)
  if (!configuration) return ability

  const configuredUsage = Object.prototype.hasOwnProperty.call(
    configuration,
    "usage",
  )
    ? configuration.usage
      ? {
          ...configuration.usage,
          used: Math.min(
            getUsageMaximum(configuration.usage),
            Math.max(0, ability.usage?.used ?? configuration.usage.used),
          ),
        }
      : undefined
    : ability.usage

  const configured: Ability = {
    ...ability,
    ...configuration,
    id: ability.id,
    name: configuration.name ?? ability.name,
    description: configuration.description ?? ability.description,
    usage: configuredUsage,
    originalAbilityId: ability.originalAbilityId,
    acquisition: ability.acquisition,
  }

  if (!configured.grantedSpells?.length || !configured.acquisition) {
    return configured
  }

  return {
    ...configured,
    grantedSpells: configured.grantedSpells.map((grant) => ({
      ...grant,
      acquisition:
        grant.acquisition ??
        createCharacterAcquisition({
          ...configured.acquisition!,
          sourceType: "ability",
          sourceId: configured.id,
          sourceName: configured.name,
        }),
    })),
  }
}

export function getProgressionAbilityConfig(
  ability: Ability,
): ProgressionAbilityConfig | undefined {
  const sourceAbilityId = ability.originalAbilityId ?? ability.id
  const parsed = parseProgressionAbilityId(sourceAbilityId)
  if (!parsed) return undefined

  const progression = getClassProgression(parsed.className)
  const feature =
    parsed.subclassId === "base"
      ? progression.features.find((entry) => entry.id === parsed.featureId)
      : progression.subclasses
          .find((entry) => entry.id === parsed.subclassId)
          ?.features.find((entry) => entry.id === parsed.featureId)

  return readAbilityConfiguration(feature)
}

function readAbilityConfiguration(
  feature: LevelFeatureDefinition | undefined,
): ProgressionAbilityConfig | undefined {
  return (feature as ConfiguredLevelFeatureDefinition | undefined)?.ability
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

function getUsageMaximum(usage: NonNullable<Ability["usage"]>): number {
  return usage.maxFormula ? Number.MAX_SAFE_INTEGER : Math.max(0, usage.max)
}
