import { defineSubclass, feature } from "../../../../builders"

export const inquisitive = defineSubclass({
  id: "inquisitive",
  name: "Inquisitive",
  className: "rogue",
  source: "Xanathar",
  features: [
    feature(3, "Ear for Deceit", "Xanathar"),
    feature(3, "Eye for Detail", "Xanathar"),
    feature(3, "Insightful Fighting", "Xanathar"),
    feature(9, "Steady Eye", "Xanathar"),
    feature(13, "Unerring Eye", "Xanathar"),
    feature(17, "Eye for Weakness", "Xanathar"),
  ],
})
