// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  useAbilityEffect,
  restoreAbilityUse,
} from "../abilities/abilityActivation"
import {
  getChannelDivinityPool,
  recoverChannelDivinity,
  restoreChannelDivinity,
  spendChannelDivinity,
} from "./characterChannelDivinity"
import {
  getKiPool,
  recoverKi,
  restoreKi,
  spendKi,
} from "./characterKi"
import { getEquipmentAbilities } from "./characterEquipment"
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

/**
 * Compatibilidade para consumidores que ainda precisam da representação
 * max/used/remaining. A fonte real é magic.channelDivinity.
 */
export function getChannelDivinityUsage(character: CharacterTemplate): {
  max: number
  used: number
  remaining: number
} {
  const pool = getChannelDivinityPool(character)
  return pool
    ? { max: pool.max, used: pool.used, remaining: pool.current }
    : { max: 0, used: 0, remaining: 0 }
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
    const pool = getChannelDivinityPool(character)
    if (!pool || pool.current <= 0) return character

    const activated = useAbilityEffect(
      character,
      { ...ability, usage: undefined },
      { type: "character" },
    )
    return spendChannelDivinity(activated)
  }

  if (ability.category === "martialArts") {
    const pool = getKiPool(character)
    if (!pool || pool.current <= 0) return character

    const activated = useAbilityEffect(
      character,
      { ...ability, usage: undefined },
      { type: "character" },
    )
    return spendKi(activated)
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
    return recoverChannelDivinity(character)
  }
  if (target?.category === "martialArts") {
    return recoverKi(character)
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
  const characterAbilities = character.get("abilities") ?? []
  const equipmentAbilities = getEquipmentAbilities(character)

  return [...characterAbilities, ...equipmentAbilities]
}

export function restoreAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const target = (character.get("abilities") ?? []).find((ability) => ability.id === abilityId)
  if (target?.category === "channelDivinity") {
    return restoreChannelDivinity(character)
  }
  if (target?.category === "martialArts") {
    return restoreKi(character)
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  )
}
