import { defineClassProgression } from "../../builders"
import { barbarianSubclasses } from "./subclasses"

export const barbarianProgression = defineClassProgression({
  className: "barbarian",
  subclasses: barbarianSubclasses,
})
