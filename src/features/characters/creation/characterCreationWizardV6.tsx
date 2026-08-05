import { useCallback, useState, type ComponentProps } from "react"

import "../../../models/leveling/ExpandedClassProgression"
import type { Itemmable } from "../../../models/items/item"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"
import { ProgressionModalInstantSelectionBridge } from "../progression/ProgressionModalInstantSelectionBridge"
import { ProgressionSpellSelectionModal } from "../progression/ProgressionSpellSelectionModal"
import {
  CharacterCreationEquipmentChoices,
  type EquipmentOverride,
} from "./CharacterCreationEquipmentChoices"
import { IntegratedCharacterCreationWizard } from "./IntegratedCharacterCreationWizard"

export type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

export function CharacterCreationWizard(
  props: ComponentProps<typeof IntegratedCharacterCreationWizard>,
) {
  const [equipmentOverride, setEquipmentOverride] =
    useState<EquipmentOverride | null>(null)
  const handleEquipmentChange = useCallback(
    (next: EquipmentOverride | null) => setEquipmentOverride(next),
    [],
  )

  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        onCreate={(character, plan) => {
          const inventory = replaceClassStartingEquipment(
            character.get("inventory") ?? [],
            equipmentOverride?.items,
          )
          props.onCreate(
            refreshProgressionFeatureMechanics(
              finalizeProgressionFeatures(
                character.with("inventory", inventory),
              ),
            ),
            plan,
          )
        }}
      />
      <CharacterCreationEquipmentChoices onChange={handleEquipmentChange} />
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
