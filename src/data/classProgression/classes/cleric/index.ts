import { defineClassProgression } from "../../builders"
import { clericSubclasses } from "./subclasses"

export const clericProgression = defineClassProgression({
  className: "cleric",
  subclasses: clericSubclasses,
})
