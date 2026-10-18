import type { Ability, Usage } from "../../models/abilities/Ability"
import type { SpellGrant } from "../../models/magic/spells/SpellGrant"

export type ProgressionAbilityUsageConfig = Omit<
  Usage,
  "used" | "cooldownRemaining"
>

export type ProgressionSpellGrant = Omit<SpellGrant, "acquisition">

type RuntimeOwnedAbilityField =
  | "id"
  | "originalAbilityId"
  | "acquisition"
  | "usage"
  | "benefitsActive"
  | "modifiersActive"
  | "source"
  | "sourceItemId"
  | "sourceItemName"
  | "grantedSpells"

/**
 * Static class/subclass feature configuration.
 *
 * Identity, provenance and mutable state are character-owned and therefore
 * cannot be declared in progression data.
 */
export type ProgressionAbilityConfig = Partial<
  Omit<Ability, RuntimeOwnedAbilityField>
> & {
  usage?: ProgressionAbilityUsageConfig
  grantedSpells?: ProgressionSpellGrant[]
}

export type ApplyProgressionAbilityTemplateOptions = {
  /** Keep the projected name/description of choice-derived abilities. */
  preserveContent?: boolean
}

/** Declares a feature ability without widening literal values. */
export function defineProgressionAbility<
  const T extends ProgressionAbilityConfig,
>(configuration: T): T {
  return configuration
}

/** Creates a static usage definition; consumed uses remain character-owned. */
export function progressionUsage(
  max: number,
  reset: ProgressionAbilityUsageConfig["reset"],
  options: Partial<
    Omit<ProgressionAbilityUsageConfig, "max" | "reset">
  > = {},
): ProgressionAbilityUsageConfig {
  return { max, reset, ...options }
}

/** Creates a spell grant without runtime acquisition metadata. */
export function grantProgressionSpell(
  index: string,
  options: Omit<ProgressionSpellGrant, "index"> = {},
): ProgressionSpellGrant {
  return { index, ...options }
}

/**
 * Applies static progression data while preserving runtime identity and state.
 * This function is used both for newly materialized features and migrations.
 */
export function applyProgressionAbilityTemplate(
  ability: Ability,
  configuration: ProgressionAbilityConfig | undefined,
  options: ApplyProgressionAbilityTemplateOptions = {},
): Ability {
  if (!configuration) return ability

  const { usage: usageConfiguration, ...staticConfiguration } = configuration
  const hasUsageConfiguration = Object.prototype.hasOwnProperty.call(
    configuration,
    "usage",
  )
  const usage = hasUsageConfiguration
    ? usageConfiguration
      ? {
          ...usageConfiguration,
          used: clampUsedUses(
            ability.usage?.used ?? 0,
            usageConfiguration,
          ),
          cooldownRemaining: ability.usage?.cooldownRemaining,
        }
      : undefined
    : ability.usage
  const preserveContent = options.preserveContent === true

  return {
    ...ability,
    ...staticConfiguration,
    id: ability.id,
    name: preserveContent
      ? ability.name
      : staticConfiguration.name ?? ability.name,
    description: preserveContent
      ? ability.description
      : staticConfiguration.description ?? ability.description,
    usage,
    source: ability.source,
    sourceItemId: ability.sourceItemId,
    sourceItemName: ability.sourceItemName,
    originalAbilityId: ability.originalAbilityId,
    acquisition: ability.acquisition,
    benefitsActive: ability.benefitsActive,
    modifiersActive: ability.modifiersActive,
  }
}

function clampUsedUses(
  used: number,
  usage: ProgressionAbilityUsageConfig,
): number {
  const normalized = Math.max(0, Math.trunc(Number(used) || 0))
  if (usage.maxFormula?.trim()) return normalized
  return Math.min(
    Math.max(0, Math.trunc(Number(usage.max) || 0)),
    normalized,
  )
}
