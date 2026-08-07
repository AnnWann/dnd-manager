import type { ComponentProps } from "react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>

export function CharacterProgressionFlow(props: Props) {
  return <CharacterProgressionConfigurator {...props} />
}

/** Compatibility helper: subclass spells are no longer generated automatically. */
export function finalizeDynamicSubclassSpells(
  character: CharacterTemplate,
  ..._ignored: unknown[]
): CharacterTemplate {
  return character
}
