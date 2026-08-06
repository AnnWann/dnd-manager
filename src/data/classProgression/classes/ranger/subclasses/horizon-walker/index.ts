import { defineSubclass, feature } from "../../../../builders"

export const horizonWalker = defineSubclass({
  id: "horizon-walker",
  name: "Horizon Walker",
  className: "ranger",
  source: "Xanathar",
  features: [
    feature(3, "Horizon Walker Magic", "Xanathar"),
    feature(3, "Detect Portal", "Xanathar"),
    feature(3, "Planar Warrior", "Xanathar"),
    feature(7, "Ethereal Step", "Xanathar"),
    feature(11, "Distant Strike", "Xanathar"),
    feature(15, "Spectral Defense", "Xanathar"),
  ],
})
