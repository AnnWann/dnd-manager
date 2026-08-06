import { defineSubclass, feature } from "../../../../builders"

export const berserker = defineSubclass({
  id: "berserker",
  name: "Path of the Berserker",
  className: "barbarian",
  source: "PHB",
  features: [
    feature(3, "Frenzy"),
    feature(6, "Mindless Rage"),
    feature(10, "Intimidating Presence"),
    feature(14, "Retaliation"),
  ],
})
