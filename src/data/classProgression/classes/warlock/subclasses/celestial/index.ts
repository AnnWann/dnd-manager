import { defineSubclass, feature } from "../../../../builders"

export const celestial = defineSubclass({
  id: "celestial",
  name: "The Celestial",
  className: "warlock",
  source: "Xanathar",
  features: [
    feature(1, "Expanded Spell List", "Xanathar"),
    feature(1, "Bonus Cantrips", "Xanathar"),
    feature(1, "Healing Light", "Xanathar"),
    feature(6, "Radiant Soul", "Xanathar"),
    feature(10, "Celestial Resilience", "Xanathar"),
    feature(14, "Searing Vengeance", "Xanathar"),
  ],
})
