import { defineClassProgression } from "../../builders"
import { warlockSubclasses } from "./subclasses"

export const warlockProgression = defineClassProgression({
  className: "warlock",
  subclasses: warlockSubclasses,
})
