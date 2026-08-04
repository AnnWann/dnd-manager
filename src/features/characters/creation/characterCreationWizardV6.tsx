import type { ComponentProps } from "react"

import "../../../models/leveling/ExpandedClassProgression"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"
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
          props.onCreate(finalizeProgressionFeatures(character), plan)
        }
      />
      <ProgressionFeatureModalEnhancer />
    </>
  )
}
