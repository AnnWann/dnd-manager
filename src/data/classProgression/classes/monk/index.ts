import { defineClassProgression } from "../../builders"
import { monkSubclasses } from "./subclasses"

export const monkProgression = defineClassProgression({
  className: "monk",
  subclasses: monkSubclasses,
})
