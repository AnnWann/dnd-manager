import { useCallback, useState, type ComponentProps } from "react"

import "../../../models/leveling/ExpandedClassProgression"
import type { Itemmable } from "../../../models/items/item"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { materializeProgressionChoices } from "../../../models/leveling/materializeProgressionChoices"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import type { RacialAttributeBonusRule } from "../../../models/races/CharacterRace"
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
import { CharacterCreationWeaponCategoryFilter } from "./CharacterCreationWeaponCategoryFilter"
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
  const [blockingError, setBlockingError] = useState("")
  const handleEquipmentChange = useCallback(
    (next: EquipmentOverride | null) => {
      setEquipmentOverride(next)
      setBlockingError("")
    },
    [],
  )
  const handleAbilityScoreChange = useCallback(
    (next: AbilityScoreOverride | null) => {
      setAbilityScoreOverride(next)
      setBlockingError("")
    },
    [],
  )
  const handleRacialChoiceChange = useCallback(
    (next: RacialChoiceOverride | null) => {
      setRacialChoiceOverride(next)
      if (next?.valid) {
        setRacialChoiceError("")
        setBlockingError("")
      }
    },
    [],
  )
  const handleGenericRacialChange = useCallback(
    (next: GenericRacialChoiceOverride | null) => {
      setGenericRacialOverride(next)
      if (next?.valid) {
        setRacialChoiceError("")
        setBlockingError("")
      }
    },
    [],
  )

  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        onCreate={(character, plan) => {
          const bonusRule = readRacialBonusRule()
          const racialBonusError = validateRacialBonusDistribution(
            bonusRule,
            abilityScoreOverride?.racialBonuses,
          )
          if (racialBonusError) {
            setBlockingError(racialBonusError)
            return
          }

          const unresolvedEquipment =
            equipmentOverride?.mode === "equipment" &&
            equipmentOverride.items.some((item) =>
              normalize(item.name).includes("a escolha"),
            )
          if (unresolvedEquipment) {
            setBlockingError(
              "Escolha uma arma concreta do compêndio ou crie uma arma personalizada para cada entrada genérica do equipamento inicial.",
            )
            return
          }

          const invalidRaceChoice =
            (racialChoiceOverride && !racialChoiceOverride.valid
              ? racialChoiceOverride.error
              : undefined) ??
            (genericRacialOverride && !genericRacialOverride.valid
              ? genericRacialOverride.error
              : undefined)
          if (invalidRaceChoice) {
            setRacialChoiceError(invalidRaceChoice)
            setBlockingError(invalidRaceChoice)
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
                attributeBonusRule: bonusRule,
              },
            },
          })
          setBlockingError("")
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
      <CharacterCreationWeaponCategoryFilter />
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
      {blockingError ? (
        <div className="fixed left-1/2 top-4 z-[260] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger shadow-theme-lg">
          {blockingError}
        </div>
      ) : null}
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

function readRacialBonusRule(): RacialAttributeBonusRule {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  )
  const selected = buttons.find(
    (button) =>
      button.classList.contains("bg-accentBg") &&
      [
        "Predefinidos",
        "+1 / +1",
        "Móveis +2 / +1",
        "Móveis +1 / +1 / +1",
        "Personalizados",
      ].includes(button.textContent?.trim() ?? ""),
  )
  const label = selected?.textContent?.trim()
  if (label === "+1 / +1") return "variant-1-1"
  if (label === "Móveis +2 / +1") return "flexible-2-1"
  if (label === "Móveis +1 / +1 / +1") return "flexible-1-1-1"
  if (label === "Personalizados") return "custom"
  return "fixed"
}

function validateRacialBonusDistribution(
  rule: RacialAttributeBonusRule,
  bonuses: Partial<Record<string, number>> | undefined,
): string {
  if (!bonuses) return "Defina os bônus raciais antes de confirmar."
  const values = Object.values(bonuses)
    .map((value) => Math.max(0, Math.trunc(Number(value) || 0)))
    .filter((value) => value > 0)
    .toSorted((left, right) => right - left)
  const signature = values.join(",")

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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
