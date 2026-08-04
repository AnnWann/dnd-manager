// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  useAbilityEffect,
  restoreAbilityUse,
} from "../abilities/abilityActivation"
import { createCharacterAcquisition } from "./CharacterAcquisition"
import { getEquipmentAbilities } from "./characterEquipment"
import type { CharacterTemplate } from "./CharacterTemplate"

export function addAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  return character.with("abilities", [
    ...(character.get("abilities") ?? []),
    withManualAbilityMetadata(character, ability),
  ])
}

export function updateAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
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
  const ability = (character.get("abilities") ?? []).find(
    (current) => current.id === abilityId,
  )
  return ability
    ? useAbilityEffect(character, ability, { type: "character" })
    : character
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
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  )
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
    sourceName: ability.sourceItemName || "Adição manual à ficha",
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
