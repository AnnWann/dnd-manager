import { defineSubclass, feature } from "../../../../builders"

export const wildMagic = defineSubclass({
  id: "wild-magic",
  name: "Path of Wild Magic",
  className: "barbarian",
  source: "Tasha",
  features: [
    feature(3, "Magic Awareness", "Tasha"),
    feature(3, "Wild Surge", "Tasha"),
    feature(6, "Bolstering Magic", "Tasha"),
    feature(10, "Unstable Backlash", "Tasha"),
    feature(14, "Controlled Surge", "Tasha"),
  ],
})
