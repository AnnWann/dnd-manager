import { defineClassProgression } from "../../builders"
import { rogueSubclasses } from "./subclasses"

export const rogueProgression = defineClassProgression({
  className: "rogue",
  subclasses: rogueSubclasses,
})
