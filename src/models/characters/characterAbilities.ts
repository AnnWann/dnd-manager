// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  applyAbilityDefault,
  saveAbilityDefault,
} from "../abilities/AbilityDefaults"
import { getEquipmentAbilities } from "./characterEquipment"
import type { CharacterTemplate } from "./CharacterTemplate"

export function addAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const normalized = applyAbilityDefault(ability)

  return character.with("abilities", [
    ...(character.get("abilities") ?? []),
    normalized,
  ])
}

export function updateAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const normalized = applyAbilityDefault(ability)

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((a) =>
      a.id === normalized.id ? normalized : a,
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
  const previous = (character.get("abilities") ?? []).find(
    (entry) => entry.id === ability.id,
  )
  const normalized: Ability = {
    ...ability,
    sourceAbilityId:
      ability.sourceAbilityId ?? previous?.sourceAbilityId,
    sourceVersion: ability.sourceVersion ?? previous?.sourceVersion,
    customized: true,
  }

  saveAbilityDefault(normalized)

  return previous
    ? updateAbility(character, normalized)
    : addAbility(character, normalized)
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

export function getCharacterAbilities(
  character: CharacterTemplate,
): Ability[] {
  const characterAbilities = character.get("abilities") ?? []
  const equipmentAbilities = getEquipmentAbilities(character)

  return [...characterAbilities, ...equipmentAbilities]
}

export function restoreAbility(
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
          used: Math.max(0, a.usage.used - 1),
        },
      }
    }),
  )
}
