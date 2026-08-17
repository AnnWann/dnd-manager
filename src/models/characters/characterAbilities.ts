// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  getAbilityUsageMax,
  useAbilityEffect,
  restoreAbilityUse,
} from "../abilities/abilityActivation"
import { createCharacterAcquisition } from "./CharacterAcquisition"
import {
  getCharacterAsis,
  withCharacterAsis,
} from "./CharacterAsi"
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
  const normalized = withManualAbilityMetadata(character, ability)
  if (normalized.category === "invocation") {
    return withInvocations(character, [...getInvocations(character), normalized])
  }

  return character.with("abilities", [
    ...(character.get("abilities") ?? []),
    normalized,
  ])
}

export function updateAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const asiEntry = getCharacterAsis(character).find(
    (entry) => entry.ability?.id === ability.id,
  )
  if (asiEntry) {
    return withCharacterAsis(
      character,
      getCharacterAsis(character).map((entry) =>
        entry.id === asiEntry.id
          ? {
              ...entry,
              ability: {
                ...ability,
                category: "feat",
                source: "asi",
                acquisition: ability.acquisition ?? entry.ability?.acquisition,
              },
            }
          : entry,
      ),
    )
  }

  const invocationExists = getInvocations(character).some(
    (current) => current.id === ability.id,
  )
  if (invocationExists || ability.category === "invocation") {
    const normalized = withManualAbilityMetadata(character, {
      ...ability,
      category: "invocation",
    })
    return withInvocations(
      character.with(
        "abilities",
        (character.get("abilities") ?? []).filter(
          (current) => current.id !== ability.id,
        ),
      ),
      invocationExists
        ? getInvocations(character).map((current) =>
            current.id === normalized.id
              ? {
                  ...normalized,
                  acquisition: normalized.acquisition ?? current.acquisition,
                }
              : current,
          )
        : [...getInvocations(character), normalized],
    )
  }

  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((current) =>
      current.id === ability.id
        ? {
            ...ability,
            acquisition:
              ability.acquisition ??
              current.acquisition ??
              withManualAbilityMetadata(character, ability).acquisition,
          }
        : current,
    ),
  )
}

export function removeAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const asiEntry = getCharacterAsis(character).find(
    (entry) => entry.ability?.id === abilityId,
  )
  const withoutAsi = asiEntry
    ? withCharacterAsis(
        character,
        getCharacterAsis(character).filter((entry) => entry.id !== asiEntry.id),
      )
    : character

  return withInvocations(
    withoutAsi.with(
      "abilities",
      (withoutAsi.get("abilities") ?? []).filter(
        (ability) => ability.id !== abilityId,
      ),
    ),
    getInvocations(withoutAsi).filter((ability) => ability.id !== abilityId),
  )
}

export function saveAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const exists = [
    ...(character.get("abilities") ?? []),
    ...getInvocations(character),
    ...getAsiAbilities(character),
  ].some((current) => current.id === ability.id)

  return exists ? updateAbility(character, ability) : addAbility(character, ability)
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
  const directAbility = findStoredCharacterAbility(character, abilityId)
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

  return useAbilityEffect(character, ability, source, activationOptionId)
}

export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const directAbility = findStoredCharacterAbility(character, abilityId)
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
  const target = findStoredCharacterAbility(character, abilityId)
  if (target?.category === "channelDivinity") return recoverChannelDivinity(character)
  if (target?.category === "martialArts") return recoverKi(character)

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
          ? { ...ability.usage, used: 0, cooldownRemaining: undefined }
          : ability.usage,
      }),
    )
  }

  if (!target.usage) return character
  return updateAbility(character, {
    ...target,
    benefitsActive: abilityRequiresActivation(target) ? false : undefined,
    modifiersActive: undefined,
    usage: {
      ...target.usage,
      used: 0,
      cooldownRemaining: undefined,
    },
  })
}

export function getCharacterAbilities(
  character: CharacterTemplate,
): Ability[] {
  const characterAbilities = character.get("abilities") ?? []
  const invocations = getInvocations(character)
  const asiAbilities = getAsiAbilities(character)
  const asiScoreBonuses = getAsiScoreBonusAbilities(character)
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

  return [
    ...characterAbilities,
    ...invocations,
    ...asiAbilities,
    ...asiScoreBonuses,
    ...equipmentAbilities,
    ...conditionAbilities,
  ]
}

export function restoreAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const target = findStoredCharacterAbility(character, abilityId)
  if (target?.category === "channelDivinity") return restoreChannelDivinity(character)
  if (target?.category === "martialArts") return restoreKi(character)

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

  return updateAbility(character, restoreAbilityUse(target))
}

function findStoredCharacterAbility(
  character: CharacterTemplate,
  abilityId: string,
): Ability | undefined {
  return (
    (character.get("abilities") ?? []).find((ability) => ability.id === abilityId) ??
    getInvocations(character).find((ability) => ability.id === abilityId) ??
    getAsiAbilities(character).find((ability) => ability.id === abilityId)
  )
}

function getInvocations(character: CharacterTemplate): Ability[] {
  return character.get("magic")?.invocations ?? []
}

function getAsiAbilities(character: CharacterTemplate): Ability[] {
  return getCharacterAsis(character)
    .map((entry) => entry.ability)
    .filter((ability): ability is Ability => Boolean(ability))
    .map((ability) => ({
      ...ability,
      category: "feat",
      source: "asi",
    }))
}

function getAsiScoreBonusAbilities(character: CharacterTemplate): Ability[] {
  return getCharacterAsis(character)
    .filter((entry) =>
      Object.values(entry.increases).some((amount) => (amount ?? 0) > 0),
    )
    .map((entry) => ({
      id: `asi-score:${entry.id}`,
      name: `ASI — nível ${entry.classLevel}`,
      kind: "feature" as const,
      category: "general" as const,
      source: "asi",
      acquisition: entry.acquisition,
      bonuses: {
        attribute: Object.entries(entry.increases)
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([attribute, amount]) => ({
            attribute: attribute as Attribute,
            bonus: {
              type: "add" as const,
              value: amount ?? 0,
              label: "ASI",
            },
          })),
      },
    }))
}

function withInvocations(
  character: CharacterTemplate,
  invocations: Ability[],
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  return character.with("magic", { ...magic, invocations })
}

function withManualAbilityMetadata(
  character: CharacterTemplate,
  ability: Ability,
): Ability {
  if (ability.acquisition) return ability

  const characterLevel = (character.get("sheet").classes ?? []).reduce(
    (sum, entry) => sum + entry.level,
    0,
  )
  const sourceType =
    ability.source === "race"
      ? "race"
      : ability.source === "equipment"
        ? "equipment"
        : ability.category === "feat"
          ? "feat"
          : "manual"
  const acquisition = createCharacterAcquisition({
    characterLevel,
    sourceType,
    sourceId: ability.sourceItemId,
    sourceName:
      ability.category === "invocation"
        ? "Evocação"
        : ability.sourceItemName || "Adição manual à ficha",
    reason: "manual",
  })

  return {
    ...ability,
    acquisition,
    grantedSpells: ability.grantedSpells?.map((grant) => ({
      ...grant,
      acquisition:
        grant.acquisition ??
        createCharacterAcquisition({
          ...acquisition,
          sourceType: "ability",
          sourceId: ability.id,
          sourceName: ability.name,
        }),
    })),
  }
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
