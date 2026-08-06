import { defineSubclass, feature } from "../../../../builders"

export const tempest = defineSubclass({
  id: "tempest",
  name: "Tempest Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Bonus Proficiencies"),
    feature(1, "Wrath of the Storm"),
    feature(2, "Destructive Wrath"),
    feature(6, "Thunderbolt Strike"),
    feature(8, "Divine Strike"),
    feature(17, "Stormborn"),
  ],
})
