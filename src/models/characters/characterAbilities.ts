// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  useAbilityEffect,
  restoreAbilityUse,
} from "../abilities/abilityActivation"
import { getEquipmentAbilities } from "./characterEquipment"
import type { CharacterTemplate } from "./CharacterTemplate"

const CHANNEL_DIVINITY_DEFAULT_MAX = 1

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

export function getChannelDivinityUsage(character: CharacterTemplate): {
  max: number
  used: number
  remaining: number
} {
  const abilities = (character.get("abilities") ?? []).filter(
    (ability) => ability.category === "channelDivinity",
  )
  const explicit = abilities.find((ability) => ability.usage)?.usage
  const max = Math.max(1, explicit?.max ?? CHANNEL_DIVINITY_DEFAULT_MAX)
  const used = Math.min(
    max,
    Math.max(0, ...abilities.map((ability) => ability.usage?.used ?? 0)),
  )
  return { max, used, remaining: Math.max(0, max - used) }
}

function withSharedChannelDivinityUsage(
  character: CharacterTemplate,
  used: number,
): CharacterTemplate {
  const current = getChannelDivinityUsage(character)
  const nextUsed = Math.max(0, Math.min(current.max, used))
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.category === "channelDivinity"
        ? {
            ...ability,
            usage: {
              ...(ability.usage ?? {
                max: current.max,
                reset: "shortRest" as const,
              }),
              max: ability.usage?.max ?? current.max,
              used: nextUsed,
            },
          }
        : ability,
    ),
  )
}

export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  if (!ability) return character

  if (ability.category === "channelDivinity") {
    const usage = getChannelDivinityUsage(character)
    if (usage.remaining <= 0) return character
    const normalizedAbility: Ability = {
      ...ability,
      usage: {
        ...(ability.usage ?? { max: usage.max, reset: "shortRest" }),
        max: ability.usage?.max ?? usage.max,
        used: usage.used,
      },
    }
    const activated = useAbilityEffect(character, normalizedAbility, { type: "character" })
    return withSharedChannelDivinityUsage(activated, usage.used + 1)
  }

  return useAbilityEffect(character, ability, { type: "character" })
}

export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  return ability
    ? endAbilityEffect(character, ability, { type: "character" })
    : character
}

export function resetAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const target = (character.get("abilities") ?? []).find((ability) => ability.id === abilityId)
  if (target?.category === "channelDivinity") {
    return withSharedChannelDivinityUsage(character, 0)
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((a) => {
      if (a.id !== abilityId || !a.usage) return a

      return {
        ...a,
        benefitsActive: abilityRequiresActivation(a) ? false : undefined,
        modifiersActive: undefined,
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
  const channelDivinity = getChannelDivinityUsage(character)
  const characterAbilities = (character.get("abilities") ?? []).map((ability) =>
    ability.category === "channelDivinity"
      ? {
          ...ability,
          usage: {
            ...(ability.usage ?? {
              max: channelDivinity.max,
              reset: "shortRest" as const,
            }),
            max: ability.usage?.max ?? channelDivinity.max,
            used: channelDivinity.used,
          },
        }
      : ability,
  )
  const equipmentAbilities = getEquipmentAbilities(character)

  return [...characterAbilities, ...equipmentAbilities]
}

export function restoreAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const target = (character.get("abilities") ?? []).find((ability) => ability.id === abilityId)
  if (target?.category === "channelDivinity") {
    const usage = getChannelDivinityUsage(character)
    return withSharedChannelDivinityUsage(character, usage.used - 1)
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  )
}