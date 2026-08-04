import { useRef, useState } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import "../../../models/leveling/ExpandedClassProgression"
import { prepareCharacterForProgression } from "../../../models/leveling/prepareCharacterForProgression"
import type { Player } from "../../../models/player/Player"
import { CharacterProgressionFlow } from "../progression/CharacterProgressionFlow"
import { hydrateCharacterStartingInventory } from "./backgroundStartingEquipment"
import {
  CharacterCreationWizard as BaseCharacterCreationWizard,
  type CharacterCreationProgressionPlan,
} from "./characterCreationWizardV5"
import { StartingInventoryReview } from "./startingInventoryReview"

type Props = {
  open: boolean
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (
    character: CharacterTemplate,
    plan: CharacterCreationProgressionPlan,
  ) => void
  createOwner: (ownerName: string) => Player
  mode?: "modal" | "page"
}

type PendingCharacter = {
  character: CharacterTemplate
  plan: CharacterCreationProgressionPlan
  stage: "progression" | "inventory"
}

export function CharacterCreationWizard(props: Props) {
  const [pending, setPending] = useState<PendingCharacter | null>(null)
  const suppressBaseClose = useRef(false)

  if (!props.open) return null

  if (pending) {
    return (
      <div
        className={
          props.mode === "page"
            ? "mx-auto w-full max-w-6xl px-2 py-4 sm:px-4"
            : "fixed inset-0 z-[90] overflow-y-auto bg-black/65 p-3 backdrop-blur-sm sm:p-4"
        }
      >
        {pending.stage === "progression" ? (
          <CharacterProgressionFlow
            mode="creation"
            character={pending.character}
            targetTotalLevel={pending.plan.targetLevel}
            primaryClassName={pending.plan.className}
            onCancel={props.onClose}
            onComplete={(character) =>
              setPending((current) =>
                current
                  ? {
                      ...current,
                      character,
                      stage: "inventory",
                    }
                  : current,
              )
            }
          />
        ) : (
          <StartingInventoryReview
            character={pending.character}
            plan={pending.plan}
            onCancel={props.onClose}
            onConfirm={(character) => props.onCreate(character, pending.plan)}
          />
        )}
      </div>
    )
  }

  return (
    <BaseCharacterCreationWizard
      {...props}
      onClose={() => {
        if (suppressBaseClose.current) {
          suppressBaseClose.current = false
          return
        }
        props.onClose()
      }}
      onCreate={(character, plan) => {
        suppressBaseClose.current = true
        setPending({
          character: prepareCharacterForProgression(
            hydrateCharacterStartingInventory(character),
          ),
          plan,
          stage: "progression",
        })
      }}
    />
  )
}

export type { CharacterCreationProgressionPlan }
