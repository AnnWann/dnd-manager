import type { ComponentProps } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"
import { CustomAwareLevelUpProgressionConfigurator } from "./CustomAwareLevelUpProgressionConfigurator"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>

export function CharacterProgressionFlow(props: Props) {
  if (props.mode === "level-up") {
    return (
      <CustomAwareLevelUpProgressionConfigurator
        character={props.character}
        primaryClassName={props.primaryClassName}
        onCancel={props.onCancel}
        onComplete={props.onComplete}
      />
    )
  }

  return <CharacterProgressionConfigurator {...props} />
}

/** Compatibility helper: subclass spells are no longer generated automatically. */
export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
  ..._ignored: unknown[]
): CharacterTemplate {
  return character
}
