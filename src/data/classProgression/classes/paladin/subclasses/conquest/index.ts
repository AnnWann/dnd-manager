import { defineSubclass, feature } from "../../../../builders"

export const conquest = defineSubclass({
  id: "conquest",
  name: "Oath of Conquest",
  className: "paladin",
  source: "Xanathar",
  features: [
    feature(3, "Oath Spells", "Xanathar"),
    feature(3, "Conquering Presence", "Xanathar"),
    feature(3, "Guided Strike", "Xanathar"),
    feature(7, "Aura of Conquest", "Xanathar"),
    feature(15, "Scornful Rebuke", "Xanathar"),
    feature(20, "Invincible Conqueror", "Xanathar"),
  ],
})
