import { defineClassProgression } from "../../builders"
import { paladinSubclasses } from "./subclasses"

export const paladinProgression = defineClassProgression({
  className: "paladin",
  subclasses: paladinSubclasses,
})
