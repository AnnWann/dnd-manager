import {
  normalizeDamageAffinities,
  type DamageAffinity,
} from "../combat/Damage"
import type { CharacterCondition } from "./CharacterCondition"
import type { CharacterTemplate } from "./CharacterTemplate"
import { getCharacterConditions } from "./characterConditionStorage"
import { getActiveAbilities, getEquippedItems } from "./characterStats"

export function getEffectiveDamageAffinities(
  character: CharacterTemplate,
  conditions: CharacterCondition[] = getCharacterConditions(character),
): DamageAffinity[] {
  return normalizeDamageAffinities([
    ...(character.get("sheet").damageAffinities ?? []),
    ...getEquippedItems(character).flatMap(
      (item) => item.bonuses?.damageAffinities ?? [],
    ),
    ...getActiveAbilities(character).flatMap(
      (ability) => ability.bonuses?.damageAffinities ?? [],
    ),
    ...conditions
      .filter(isConditionActive)
      .flatMap((condition) => condition.bonuses?.damageAffinities ?? []),
  ])
}

function isConditionActive(condition: CharacterCondition): boolean {
  if (
    typeof condition.duration.remaining === "number" &&
    condition.duration.remaining <= 0
  ) {
    return false
  }

  if (condition.duration.expiresAt) {
    const expiresAt = Date.parse(condition.duration.expiresAt)
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false
  }

  return true
}
