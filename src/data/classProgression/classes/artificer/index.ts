import { defineClassProgression } from "../../builders"
import { artificerSubclasses } from "./subclasses"

export const artificerProgression = defineClassProgression({
  className: "artificer",
  subclasses: artificerSubclasses,
})
