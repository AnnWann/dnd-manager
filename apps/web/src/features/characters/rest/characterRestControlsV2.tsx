import type { ComponentProps } from "react"

import { CharacterRestControls as BaseCharacterRestControls } from "./characterRestControls"
import "./characterRestControlsResponsive.css"

type Props = ComponentProps<typeof BaseCharacterRestControls>

export function CharacterRestControls(props: Props) {
  return (
    <div className="rest-controls-responsive">
      <BaseCharacterRestControls {...props} />
    </div>
  )
}
