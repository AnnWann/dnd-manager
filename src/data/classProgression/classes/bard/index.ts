import { defineClassProgression } from "../../builders"
import { bardSubclasses } from "./subclasses"

export const bardProgression = defineClassProgression({
  className: "bard",
  subclasses: bardSubclasses,
})
