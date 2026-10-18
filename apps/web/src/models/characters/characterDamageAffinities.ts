import type { Ability } from "../abilities/Ability"
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
  const activeConditions = conditions.filter(isConditionActive)
  const activeSourceAbilityIds = new Set(
    activeConditions.flatMap((condition) =>
      condition.sourceAbilityId ? [condition.sourceAbilityId] : [],
    ),
  )

  // A condição criada por uma habilidade duradoura é a evidência autoritativa
  // de que seus benefícios continuam ativos. Isso também cobre pequenos
  // intervalos de sincronização em que o snapshot da habilidade ainda não
  // refletiu benefitsActive, mas a condição já existe na sessão.
  const conditionBackedAbilities = allSourceAbilities(character).filter((ability) =>
    activeSourceAbilityIds.has(ability.id),
  )
  const activeAbilities = uniqueAbilities([
    ...getActiveAbilities(character),
    ...conditionBackedAbilities,
  ])

  return normalizeDamageAffinities([
    ...(character.get("sheet").damageAffinities ?? []),
    ...getEquippedItems(character).flatMap(
      (item) => item.bonuses?.damageAffinities ?? [],
    ),
    ...activeAbilities.flatMap(
      (ability) => ability.bonuses?.damageAffinities ?? [],
    ),
    ...activeConditions.flatMap(
      (condition) => condition.bonuses?.damageAffinities ?? [],
    ),
  ])
}

function allSourceAbilities(character: CharacterTemplate): Ability[] {
  return [
    ...(character.get("abilities") ?? []),
    ...(character.get("magic")?.invocations ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap((item) => item.abilities ?? []),
  ]
}

function uniqueAbilities(abilities: Ability[]): Ability[] {
  const seen = new Set<string>()
  return abilities.filter((ability) => {
    if (seen.has(ability.id)) return false
    seen.add(ability.id)
    return true
  })
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
