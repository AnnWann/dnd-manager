import { defineClassProgression } from "../../builders"
import { fighterSubclasses } from "./subclasses"

export const fighterProgression = defineClassProgression({
  className: "fighter",
  subclasses: fighterSubclasses,
})
