import { defineSubclass, feature } from "../../../../builders"

export const zealot = defineSubclass({
  id: "zealot",
  name: "Path of the Zealot",
  className: "barbarian",
  source: "Xanathar",
  features: [
    feature(3, "Divine Fury", "Xanathar"),
    feature(3, "Warrior of the Gods", "Xanathar"),
    feature(6, "Fanatical Focus", "Xanathar"),
    feature(10, "Zealous Presence", "Xanathar"),
    feature(14, "Rage Beyond Death", "Xanathar"),
  ],
})
