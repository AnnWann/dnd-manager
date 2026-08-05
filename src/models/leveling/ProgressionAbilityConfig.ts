import type { Ability } from "../abilities/Ability"

/**
 * Static configuration applied when a class or subclass feature is materialized
 * as an Ability. Acquisition metadata is deliberately excluded because it is
 * produced by the character-creation or level-up event.
 *
 * Every other Ability field is available. The fields are optional so existing
 * lightweight progression definitions can be migrated one feature at a time.
 */
export type ProgressionAbilityConfig = Partial<
  Omit<Ability, "acquisition">
>

/**
 * Declares an ability configuration without widening literal values.
 */
export function defineProgressionAbility<const T extends ProgressionAbilityConfig>(
  configuration: T,
): T {
  return configuration
}
