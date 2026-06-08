// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import type { CharacterTemplate } from "./CharacterTemplate"

export function addAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  return character.with("abilities", [
    ...(character.get("abilities") ?? []),
    ability,
  ])
}

export function updateAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((a) =>
      a.id === ability.id ? ability : a,
    ),
  )
}

export function removeAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).filter((a) => a.id !== abilityId),
  )
}

export function saveAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const exists = (character.get("abilities") ?? []).some(
    (a) => a.id === ability.id,
  )

  return exists
    ? updateAbility(character, ability)
    : addAbility(character, ability)
}

export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((a) => {
      if (a.id !== abilityId || !a.usage) return a

      return {
        ...a,
        usage: {
          ...a.usage,
          used: Math.min(a.usage.max, a.usage.used + 1),
        },
      }
    }),
  )
}

export function resetAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((a) => {
      if (a.id !== abilityId || !a.usage) return a

      return {
        ...a,
        usage: {
          ...a.usage,
          used: 0,
          cooldownRemaining: undefined,
        },
      }
    }),
  )
}