// models/characters/characterAbilities.ts

import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  endAbilityEffect,
  restoreAbilityUse,
  useAbilityEffect,
} from "../abilities/abilityActivation"
import { createCharacterAcquisition } from "./CharacterAcquisition"
import {
  getCharacterAsis,
  withCharacterAsis,
} from "./CharacterAsi"
import { getEquipmentAbilities } from "./characterEquipment"
import type { CharacterTemplate } from "./CharacterTemplate"

export function addAbility(
  character: CharacterTemplate,
  ability: Ability,
): CharacterTemplate {
  const normalized = withManualAbilityMetadata(character, ability)
  if (normalized.category === "invocation") {
    return withInvocations(character, [
      ...getInvocations(character),
      normalized,
    ])
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
                acquisition:
                  ability.acquisition ?? entry.ability?.acquisition,
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
    const nextInvocations = invocationExists
      ? getInvocations(character).map((current) =>
          current.id === normalized.id
            ? {
                ...normalized,
                acquisition:
                  normalized.acquisition ?? current.acquisition,
              }
            : current,
        )
      : [...getInvocations(character), normalized]

    return withInvocations(
      character.with(
        "abilities",
        (character.get("abilities") ?? []).filter(
          (current) => current.id !== ability.id,
        ),
      ),
      nextInvocations,
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
    ? removeAsiEntry(character, asiEntry.id)
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

  return exists
    ? updateAbility(character, ability)
    : addAbility(character, ability)
}

export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = findCharacterAbility(character, abilityId)
  return ability
    ? useAbilityEffect(character, ability, { type: "character" })
    : character
}

export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const ability = findCharacterAbility(character, abilityId)
  return ability
    ? endAbilityEffect(character, ability, { type: "character" })
    : character
}

export function resetAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const current = findCharacterAbility(character, abilityId)
  if (!current?.usage) return character

  return updateAbility(character, {
    ...current,
    benefitsActive: abilityRequiresActivation(current) ? false : undefined,
    modifiersActive: undefined,
    usage: {
      ...current.usage,
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

  return [
    ...characterAbilities,
    ...invocations,
    ...asiAbilities,
    ...asiScoreBonuses,
    ...equipmentAbilities,
  ]
}

export function restoreAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  const current = findCharacterAbility(character, abilityId)
  if (!current) return character
  return updateAbility(character, restoreAbilityUse(current))
}

function findCharacterAbility(
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
      kind: "passive" as const,
      category: "general" as const,
      source: "asi",
      acquisition: entry.acquisition,
      bonuses: {
        attribute: Object.entries(entry.increases)
          .filter(([, amount]) => (amount ?? 0) > 0)
          .map(([attribute, amount]) => ({
            attribute: attribute as keyof CharacterTemplate["get"] extends never
              ? never
              : "str" | "dex" | "con" | "int" | "wis" | "cha",
            bonus: {
              type: "add" as const,
              value: amount ?? 0,
              label: "ASI",
            },
          })),
      },
    }))
}

function removeAsiEntry(
  character: CharacterTemplate,
  asiId: string,
): CharacterTemplate {
  return withCharacterAsis(
    character,
    getCharacterAsis(character).filter((entry) => entry.id !== asiId),
  )
}

function withInvocations(
  character: CharacterTemplate,
  invocations: Ability[],
): CharacterTemplate {
  const magic = character.getOrCreateMagic()
  return character.with("magic", {
    ...magic,
    invocations,
  })
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
