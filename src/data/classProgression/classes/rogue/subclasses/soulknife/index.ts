import { defineSubclass, feature } from "../../../../builders"

export const soulknife = defineSubclass({
  id: "soulknife",
  name: "Soulknife",
  className: "rogue",
  source: "Tasha",
  features: [
    feature(3, "Psionic Power", "Tasha"),
    feature(3, "Psychic Blades", "Tasha"),
    feature(9, "Soul Blades", "Tasha"),
    feature(13, "Psychic Veil", "Tasha"),
    feature(17, "Rend Mind", "Tasha"),
  ],
})
