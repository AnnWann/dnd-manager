import { defineSubclass, feature } from "../../../../builders"

export const nature = defineSubclass({
  id: "nature",
  name: "Nature Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Acolyte of Nature"),
    feature(2, "Charm Animals and Plants"),
    feature(6, "Dampen Elements"),
    feature(8, "Divine Strike"),
    feature(17, "Master of Nature"),
  ],
})
