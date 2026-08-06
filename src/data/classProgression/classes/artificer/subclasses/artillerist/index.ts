import { defineSubclass, feature } from "../../../../builders"

export const artillerist = defineSubclass({
  id: "artillerist",
  name: "Artillerist",
  className: "artificer",
  source: "Tasha",
  features: [
    feature(3, "Tool Proficiency", "Tasha"),
    feature(3, "Artillerist Spells", "Tasha"),
    feature(3, "Eldritch Cannon", "Tasha"),
    feature(5, "Arcane Firearm", "Tasha"),
    feature(9, "Explosive Cannon", "Tasha"),
    feature(15, "Fortified Position", "Tasha"),
  ],
})
