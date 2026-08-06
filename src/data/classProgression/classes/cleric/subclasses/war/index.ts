import { defineSubclass, feature } from "../../../../builders"

export const war = defineSubclass({
  id: "war",
  name: "War Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Bonus Proficiencies"),
    feature(1, "War Priest"),
    feature(2, "Guided Strike"),
    feature(6, "War God's Blessing"),
    feature(8, "Divine Strike"),
    feature(17, "Avatar of Battle"),
  ],
})
