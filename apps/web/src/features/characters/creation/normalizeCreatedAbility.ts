import type { Ability } from "../../../models/abilities/Ability"

/**
 * Preserve the kind selected in the ability editor during character creation.
 * "feature" is only the legacy default when a preset omitted the kind entirely.
 * Changing a passive into a feature here also changes how its bonuses and
 * activation are presented on the finished character sheet.
 */
export function normalizeCreatedAbility(
  ability: Ability,
  source: "class" | "race",
): Ability {
  return {
    ...ability,
    kind: ability.kind ?? "feature",
    category:
      ability.category === "feat" || ability.category === "invocation"
        ? "general"
        : ability.category,
    source,
  }
}
