// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  getAbilityUsageMax,
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
import {
  getCharacterConditions,
  withCharacterConditions,
} from "./characterConditionStorage"
import type { CharacterTemplate } from "./CharacterTemplate"

type ConditionAbilityProjection = Ability & {
  source: "condition"
  sourceConditionId: string
  sourceConditionName: string
  originalAbilityId: string
}

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
  const pool = getChannelDivinityPool(character)
  return pool
    ? { max: pool.max, used: pool.used, remaining: pool.current }
    : { max: 0, used: 0, remaining: 0 }
}

export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
  activationOptionId?: string,
): CharacterTemplate {
  const directAbility = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  const projected = directAbility ? undefined : findConditionAbility(character, abilityId)
  const ability = directAbility ?? projected?.ability
  if (!ability) return character

  const source = projected
    ? {
        type: "condition" as const,
        conditionId: projected.conditionId,
        sourceLabel: projected.conditionName,
      }
    : { type: "character" as const }

  if (ability.category === "channelDivinity") {
    const pool = getChannelDivinityPool(character)
    if (!pool || pool.current <= 0) return character

    const activated = useAbilityEffect(
      character,
      { ...ability, usage: undefined },
      source,
      activationOptionId,
    )
    return spendChannelDivinity(activated)
  }

  if (ability.category === "martialArts") {
    const pool = getKiPool(character)
    if (!pool || pool.current <= 0) return character

    const activated = useAbilityEffect(
      character,
      { ...ability, usage: undefined },
      source,
      activationOptionId,
    )
    return spendKi(activated)
  }

  const sharedResourceId = ability.usage?.sharedResourceId?.trim()
  if (!projected && sharedResourceId && ability.usage) {
    if (ability.usage.used >= getAbilityUsageMax(character, ability.usage)) {
      return character
    }
    const activated = useAbilityEffect(
      character,
      { ...ability, usage: undefined },
      source,
      activationOptionId,
    )
    return updateSharedResourceUsage(activated, sharedResourceId, 1)
  }

  return useAbilityEffect(
    character,
    ability,
    source,
    activationOptionId,
  )
}

export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const directAbility = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  if (directAbility) {
    return endAbilityEffect(character, directAbility, { type: "character" })
  }

  const projected = findConditionAbility(character, abilityId)
  return projected
    ? endAbilityEffect(character, projected.ability, {
        type: "condition",
        conditionId: projected.conditionId,
        sourceLabel: projected.conditionName,
      })
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
  const sharedResourceId = target?.usage?.sharedResourceId?.trim()
  if (sharedResourceId) return setSharedResourceUsage(character, sharedResourceId, 0)

  if (!target) {
    const projected = findConditionAbility(character, abilityId)
    if (!projected) return character
    return updateConditionAbility(
      character,
      projected.conditionId,
      projected.ability.id,
      (ability) => ({
        ...ability,
        benefitsActive: abilityRequiresActivation(ability) ? false : undefined,
        modifiersActive: undefined,
        usage: ability.usage
          ? {
              ...ability.usage,
              used: 0,
              cooldownRemaining: undefined,
            }
          : ability.usage,
      }),
    )
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
  const conditionAbilities: ConditionAbilityProjection[] = getCharacterConditions(character)
    .flatMap((condition) =>
      (condition.grantedAbilities ?? []).map((ability) => ({
        ...ability,
        id: conditionAbilityProjectionId(condition.id, ability.id),
        source: "condition" as const,
        sourceConditionId: condition.id,
        sourceConditionName: condition.name,
        originalAbilityId: ability.id,
      })),
    )

  return [...characterAbilities, ...equipmentAbilities, ...conditionAbilities]
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
  const sharedResourceId = target?.usage?.sharedResourceId?.trim()
  if (sharedResourceId) return updateSharedResourceUsage(character, sharedResourceId, -1)

  if (!target) {
    const projected = findConditionAbility(character, abilityId)
    if (!projected) return character
    return updateConditionAbility(
      character,
      projected.conditionId,
      projected.ability.id,
      restoreAbilityUse,
    )
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  )
}

function findConditionAbility(
  character: CharacterTemplate,
  projectedId: string,
): {
  conditionId: string
  conditionName: string
  ability: Ability
} | undefined {
  for (const condition of getCharacterConditions(character)) {
    for (const ability of condition.grantedAbilities ?? []) {
      if (conditionAbilityProjectionId(condition.id, ability.id) === projectedId) {
        return {
          conditionId: condition.id,
          conditionName: condition.name,
          ability,
        }
      }
    }
  }
  return undefined
}

function updateConditionAbility(
  character: CharacterTemplate,
  conditionId: string,
  abilityId: string,
  updater: (ability: Ability) => Ability,
): CharacterTemplate {
  return withCharacterConditions(
    character,
    getCharacterConditions(character).map((condition) =>
      condition.id === conditionId
        ? {
            ...condition,
            grantedAbilities: (condition.grantedAbilities ?? []).map((ability) =>
              ability.id === abilityId ? updater(ability) : ability,
            ),
          }
        : condition,
    ),
  )
}

function conditionAbilityProjectionId(conditionId: string, abilityId: string): string {
  return `condition:${conditionId}:${abilityId}`
}

function updateSharedResourceUsage(
  character: CharacterTemplate,
  sharedResourceId: string,
  delta: number,
): CharacterTemplate {
  const members = (character.get("abilities") ?? []).filter(
    (ability) => ability.usage?.sharedResourceId?.trim() === sharedResourceId,
  )
  if (!members.length) return character
  const representative = members[0]
  if (!representative.usage) return character
  const nextUsed = Math.max(
    0,
    Math.min(
      getAbilityUsageMax(character, representative.usage),
      representative.usage.used + delta,
    ),
  )
  return setSharedResourceUsage(character, sharedResourceId, nextUsed)
}

function setSharedResourceUsage(
  character: CharacterTemplate,
  sharedResourceId: string,
  used: number,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) => {
      if (
        !ability.usage ||
        ability.usage.sharedResourceId?.trim() !== sharedResourceId
      ) return ability
      return {
        ...ability,
        usage: {
          ...ability.usage,
          used: Math.max(
            0,
            Math.min(getAbilityUsageMax(character, ability.usage), used),
          ),
        },
      }
    }),
  )
}
