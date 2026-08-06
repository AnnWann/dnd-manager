import { defineSubclass, feature } from "../../../../builders"

export const drunkenMaster = defineSubclass({
  id: "drunken-master",
  name: "Way of the Drunken Master",
  className: "monk",
  source: "Xanathar",
  features: [
    feature(3, "Bonus Proficiencies", "Xanathar"),
    feature(3, "Drunken Technique", "Xanathar"),
    feature(6, "Tipsy Sway", "Xanathar"),
    feature(11, "Drunkard's Luck", "Xanathar"),
    feature(17, "Intoxicated Frenzy", "Xanathar"),
  ],
})
