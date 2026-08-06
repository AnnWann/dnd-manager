import { defineSubclass, feature } from "../../../../builders"

export const life = defineSubclass({
  id: "life",
  name: "Life Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Disciple of Life"),
    feature(2, "Preserve Life"),
    feature(6, "Blessed Healer"),
    feature(8, "Divine Strike"),
    feature(17, "Supreme Healing"),
  ],
})
