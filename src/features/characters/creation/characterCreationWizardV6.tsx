import { useCallback, useState, type ComponentProps } from "react"

import "../../../models/leveling/ExpandedClassProgression"
import type { Itemmable } from "../../../models/items/item"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { materializeProgressionChoices } from "../../../models/leveling/materializeProgressionChoices"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"
import { ProgressionModalInstantSelectionBridge } from "../progression/ProgressionModalInstantSelectionBridge"
import { ProgressionSpellSelectionModal } from "../progression/ProgressionSpellSelectionModal"
import {
  CharacterCreationAbilityScoreRules,
  type AbilityScoreOverride,
} from "./CharacterCreationAbilityScoreRules"
import {
  CharacterCreationEquipmentChoices,
  type EquipmentOverride,
} from "./CharacterCreationEquipmentChoices"
import {
  CharacterCreationGenericRacialChoices,
  type GenericRacialChoiceOverride,
} from "./CharacterCreationGenericRacialChoices"
import {
  CharacterCreationRacialChoices,
  type RacialChoiceOverride,
} from "./CharacterCreationRacialChoices"
import { IntegratedCharacterCreationWizard } from "./IntegratedCharacterCreationWizard"

export type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

export function CharacterCreationWizard(
  props: ComponentProps<typeof IntegratedCharacterCreationWizard>,
) {
  const [equipmentOverride, setEquipmentOverride] =
    useState<EquipmentOverride | null>(null)
  const [abilityScoreOverride, setAbilityScoreOverride] =
    useState<AbilityScoreOverride | null>(null)
  const [racialChoiceOverride, setRacialChoiceOverride] =
    useState<RacialChoiceOverride | null>(null)
  const [genericRacialOverride, setGenericRacialOverride] =
    useState<GenericRacialChoiceOverride | null>(null)
  const [racialChoiceError, setRacialChoiceError] = useState("")
  const handleEquipmentChange = useCallback(
    (next: EquipmentOverride | null) => setEquipmentOverride(next),
    [],
  )
  const handleAbilityScoreChange = useCallback(
    (next: AbilityScoreOverride | null) => setAbilityScoreOverride(next),
    [],
  )
  const handleRacialChoiceChange = useCallback(
    (next: RacialChoiceOverride | null) => {
      setRacialChoiceOverride(next)
      if (next?.valid) setRacialChoiceError("")
    },
    [],
  )
  const handleGenericRacialChange = useCallback(
    (next: GenericRacialChoiceOverride | null) => {
      setGenericRacialOverride(next)
      if (next?.valid) setRacialChoiceError("")
    },
    [],
  )

  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        onCreate={(character, plan) => {
          const invalidRaceChoice =
            (racialChoiceOverride && !racialChoiceOverride.valid
              ? racialChoiceOverride.error
              : undefined) ??
            (genericRacialOverride && !genericRacialOverride.valid
              ? genericRacialOverride.error
              : undefined)
          if (invalidRaceChoice) {
            setRacialChoiceError(invalidRaceChoice)
            return
          }

          const inventory = replaceClassStartingEquipment(
            character.get("inventory") ?? [],
            equipmentOverride?.items,
          )
          const sheet = character.get("sheet")
          const originalRaceProficiencyIds = new Set(
            (sheet.race.proficiencies ?? []).map((entry) => entry.id),
          )
          const specificRace = racialChoiceOverride?.apply(
            sheet.race.naturalAbilities ?? [],
            sheet.race.proficiencies ?? [],
          )
          const genericRace = genericRacialOverride?.apply(
            specificRace?.proficiencies ?? sheet.race.proficiencies,
          )
          const raceProficiencies =
            genericRace?.proficiencies ??
            specificRace?.proficiencies ??
            sheet.race.proficiencies
          const proficiencies = [
            ...(sheet.proficiencies ?? []).filter(
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

          const patched = character.withPatch({
            inventory,
            sheet: {
              ...sheet,
              attributes: abilityScoreOverride?.attributes ?? sheet.attributes,
              skills,
              proficiencies,
              race: {
                ...sheet.race,
                naturalAbilities:
                  specificRace?.abilities ?? sheet.race.naturalAbilities,
                proficiencies: raceProficiencies,
                attributeBonus:
                  abilityScoreOverride?.racialBonuses ??
                  sheet.race.attributeBonus,
              },
            },
          })
          props.onCreate(
            refreshProgressionFeatureMechanics(
              materializeProgressionChoices(
                finalizeProgressionFeatures(patched),
              ),
            ),
            plan,
          )
        }}
      />
      <CharacterCreationEquipmentChoices onChange={handleEquipmentChange} />
      <CharacterCreationAbilityScoreRules onChange={handleAbilityScoreChange} />
      <CharacterCreationRacialChoices
        onChange={handleRacialChoiceChange}
        externalError={racialChoiceError}
      />
      <CharacterCreationGenericRacialChoices
        onChange={handleGenericRacialChange}
        externalError={racialChoiceError}
      />
      <ProgressionFeatureModalEnhancer />
      <ProgressionModalInstantSelectionBridge />
      <ProgressionSpellSelectionModal />
    </>
  )
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
