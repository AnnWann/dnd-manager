import { defineSubclass, feature } from "../../../../builders"

export const assassin = defineSubclass({
  id: "assassin",
  name: "Assassin",
  className: "rogue",
  source: "PHB",
  features: [
    feature(3, "Bonus Proficiencies"),
    feature(3, "Assassinate"),
    feature(9, "Infiltration Expertise"),
    feature(13, "Impostor"),
    feature(17, "Death Strike"),
  ],
})
