import type { ComponentProps } from "react"

import "../../../models/leveling/ExpandedClassProgression"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"
import { ProgressionModalInstantSelectionBridge } from "../progression/ProgressionModalInstantSelectionBridge"
import { ProgressionSpellSelectionModal } from "../progression/ProgressionSpellSelectionModal"
import { IntegratedCharacterCreationWizard } from "./IntegratedCharacterCreationWizard"

export type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

export function CharacterCreationWizard(
  props: ComponentProps<typeof IntegratedCharacterCreationWizard>,
) {
  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        onCreate={(character, plan) =>
          props.onCreate(
            refreshProgressionFeatureMechanics(
              finalizeProgressionFeatures(character),
            ),
            plan,
          )
        }
      />
      <ProgressionFeatureModalEnhancer />
      <ProgressionModalInstantSelectionBridge />
      <ProgressionSpellSelectionModal />
    </>
  )
}
