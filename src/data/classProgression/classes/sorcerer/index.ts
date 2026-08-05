import { defineClassProgression } from "../../builders"
import { sorcererSubclasses } from "./subclasses"

export const sorcererProgression = defineClassProgression({
  className: "sorcerer",
  subclasses: sorcererSubclasses,
})
