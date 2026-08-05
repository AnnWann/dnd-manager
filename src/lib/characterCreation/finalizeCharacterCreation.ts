import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../models/items/item"
import { finalizeProgressionFeatures } from "../../models/leveling/ProgressionFeatureFinalization"
import { materializeProgressionChoices } from "../../models/leveling/materializeProgressionChoices"
import { refreshProgressionFeatureMechanics } from "../../models/leveling/refreshProgressionFeatureMechanics"
import type { RacialAttributeBonusRule } from "../../models/races/CharacterRace"
import type { CharacterCreationIdentity } from "../../models/characters/creation/CharacterCreation"
import type { AbilityScoreOverride } from "../../features/characters/creation/CharacterCreationAbilityScoreRules"
import type { BackgroundChoiceOverride } from "../../features/characters/creation/CharacterCreationBackgroundChoices"
import type { EquipmentOverride } from "../../features/characters/creation/components/CharacterCreationEquipmentChoices"
import type { GenericRacialChoiceOverride } from "../../features/characters/creation/CharacterCreationGenericRacialChoices"
import type { RacialChoiceOverride } from "../../features/characters/creation/CharacterCreationRacialChoices"

export type CharacterCreationOverrides = {
  identity: CharacterCreationIdentity
  equipment?: EquipmentOverride | null
  abilityScores?: AbilityScoreOverride | null
  racialChoices?: RacialChoiceOverride | null
  genericRacialChoices?: GenericRacialChoiceOverride | null
  backgroundChoices?: BackgroundChoiceOverride | null
  racialBonusRule: RacialAttributeBonusRule
}

export type CharacterCreationValidationTarget =
  | "identity"
  | "equipment"
  | "race"
  | "background"
  | "attributes"

export type CharacterCreationValidationError = {
  target: CharacterCreationValidationTarget
  message: string
}

export function validateCharacterCreationOverrides(
  overrides: CharacterCreationOverrides,
): CharacterCreationValidationError | null {
  const identityError = validateIdentity(overrides.identity)
  if (identityError) return { target: "identity", message: identityError }

  const racialBonusError = validateRacialBonusDistribution(
    overrides.racialBonusRule,
    overrides.abilityScores?.racialBonuses,
  )
  if (racialBonusError) {
    return { target: "attributes", message: racialBonusError }
  }

  if (overrides.equipment && !overrides.equipment.valid) {
    return {
      target: "equipment",
      message:
        overrides.equipment.error ??
        "Complete todas as escolhas de equipamento da classe inicial.",
    }
  }

  const raceError =
    (overrides.racialChoices && !overrides.racialChoices.valid
      ? overrides.racialChoices.error
      : undefined) ??
    (overrides.genericRacialChoices && !overrides.genericRacialChoices.valid
      ? overrides.genericRacialChoices.error
      : undefined)
  if (raceError) return { target: "race", message: raceError }

  if (overrides.backgroundChoices && !overrides.backgroundChoices.valid) {
    return {
      target: "background",
      message:
        overrides.backgroundChoices.error ??
        "Complete todas as escolhas obrigatórias do antecedente.",
    }
  }

  return null
}

export function finalizeCreatedCharacter(
  character: CharacterTemplate,
  overrides: CharacterCreationOverrides,
): CharacterTemplate {
  const inventory = replaceClassStartingEquipment(
    character.get("inventory") ?? [],
    overrides.equipment?.items,
  )
  const sheet = character.get("sheet")
  const originalRaceProficiencyIds = new Set(
    (sheet.race.proficiencies ?? []).map((entry) => entry.id),
  )
  const backgroundProficiencies =
    overrides.backgroundChoices?.apply(sheet.proficiencies ?? []) ??
    sheet.proficiencies
  const specificRace = overrides.racialChoices?.apply(
    sheet.race.naturalAbilities ?? [],
    sheet.race.proficiencies ?? [],
  )
  const genericRace = overrides.genericRacialChoices?.apply(
    specificRace?.proficiencies ?? sheet.race.proficiencies,
  )
  const raceProficiencies =
    genericRace?.proficiencies ??
    specificRace?.proficiencies ??
    sheet.race.proficiencies
  const proficiencies = [
    ...(backgroundProficiencies ?? []).filter(
      (entry) => !originalRaceProficiencyIds.has(entry.id),
    ),
    ...raceProficiencies,
  ]
  const skills = { ...sheet.skills }
  for (const skill of [
    ...(specificRace?.skills ?? []),
    ...(genericRace?.skills ?? []),
  ]) {
    skills[skill] = "proficient"
  }

  const identity = overrides.identity
  const profile = character.get("profile")
  const history = [
    extractBackgroundTitle(profile.history),
    identity.backgroundDescription,
  ]
    .filter(Boolean)
    .join("\n")

  const patched = character.withPatch({
    name: identity.name.trim(),
    inventory,
    profile: {
      ...profile,
      alignment: identity.alignment,
      history,
      physicalAppearance: identity.physicalAppearance.trim(),
      traits: identity.personalityTraits.trim(),
      relationships: identity.relationships.map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        relation: entry.relation.trim(),
        description: entry.description?.trim() || undefined,
      })),
    },
    sheet: {
      ...sheet,
      attributes: overrides.abilityScores?.attributes ?? sheet.attributes,
      skills,
      proficiencies,
      race: {
        ...sheet.race,
        naturalAbilities:
          specificRace?.abilities ?? sheet.race.naturalAbilities,
        proficiencies: raceProficiencies,
        attributeBonus:
          overrides.abilityScores?.racialBonuses ?? sheet.race.attributeBonus,
        attributeBonusRule: overrides.racialBonusRule,
      },
    },
  })

  return refreshProgressionFeatureMechanics(
    materializeProgressionChoices(finalizeProgressionFeatures(patched)),
  )
}

function validateIdentity(identity: CharacterCreationIdentity): string {
  if (!identity.name.trim()) {
    return "Informe o nome do personagem na etapa de identidade."
  }

  const incompleteRelationship = identity.relationships.find(
    (entry) => !entry.name.trim() || !entry.relation.trim(),
  )
  if (incompleteRelationship) {
    return "Preencha o nome e o tipo de relação de cada relacionamento adicionado."
  }

  return ""
}

function validateRacialBonusDistribution(
  rule: RacialAttributeBonusRule,
  bonuses: Partial<Record<string, number>> | undefined,
): string {
  if (!bonuses) return "Defina os bônus raciais antes de confirmar."

  const signature = Object.values(bonuses)
    .map((value) => Math.max(0, Math.trunc(Number(value) || 0)))
    .filter((value) => value > 0)
    .toSorted((left, right) => right - left)
    .join(",")

  if (rule === "variant-1-1" && signature !== "1,1") {
    return "A regra +1/+1 exige dois atributos distintos, cada um recebendo +1."
  }
  if (rule === "flexible-2-1" && signature !== "2,1") {
    return "A regra móvel +2/+1 exige dois atributos distintos."
  }
  if (rule === "flexible-1-1-1" && signature !== "1,1,1") {
    return "A regra móvel +1/+1/+1 exige três atributos distintos."
  }

  return ""
}

function replaceClassStartingEquipment(
  inventory: Itemmable[],
  replacement: Itemmable[] | undefined,
): Itemmable[] {
  if (!replacement) return inventory

  const retained = inventory.filter((item) => {
    const notes = item.notes?.toLocaleLowerCase("pt-BR") ?? ""
    return !(
      notes.includes("equipamento inicial da classe") ||
      notes.includes("classe inicial:") ||
      notes.includes("moeda inicial da criação") ||
      notes.includes("ouro inicial de")
    )
  })

  return [...retained, ...replacement]
}

function extractBackgroundTitle(history: string): string {
  return (
    history
      .split("\n")
      .find((line) =>
        line.trim().toLocaleLowerCase("pt-BR").startsWith("antecedente:"),
      )
      ?.trim() ?? ""
  )
}
