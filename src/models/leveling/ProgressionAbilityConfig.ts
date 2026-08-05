import type { Ability } from "../abilities/Ability"

/**
 * Static configuration applied when a class or subclass feature is materialized
 * as an Ability.
 *
 * `id`, `originalAbilityId`, and acquisition metadata remain runtime-owned so
 * progression deduplication and audit history stay stable across later level-ups.
 * Every behavior and content field from Ability remains configurable.
 */
export type ProgressionAbilityConfig = Partial<
  Omit<Ability, "id" | "originalAbilityId" | "acquisition">
>

/**
 * Declares an ability configuration without widening literal values.
 */
export function defineProgressionAbility<const T extends ProgressionAbilityConfig>(
  configuration: T,
): T {
  return configuration
}
