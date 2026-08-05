import { defineClassProgression } from "../../builders"
import { wizardSubclasses } from "./subclasses"

export const wizardProgression = defineClassProgression({
  className: "wizard",
  subclasses: wizardSubclasses,
})
