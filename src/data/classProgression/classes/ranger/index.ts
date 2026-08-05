import { defineClassProgression } from "../../builders"
import { rangerSubclasses } from "./subclasses"

export const rangerProgression = defineClassProgression({
  className: "ranger",
  subclasses: rangerSubclasses,
})
