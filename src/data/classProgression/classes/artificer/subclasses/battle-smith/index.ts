import { defineSubclass, feature } from "../../../../builders"

export const battleSmith = defineSubclass({
  id: "battle-smith",
  name: "Battle Smith",
  className: "artificer",
  source: "Tasha",
  features: [
    feature(3, "Tool Proficiency", "Tasha"),
    feature(3, "Battle Smith Spells", "Tasha"),
    feature(3, "Battle Ready", "Tasha"),
    feature(3, "Steel Defender", "Tasha"),
    feature(5, "Extra Attack", "Tasha"),
    feature(9, "Arcane Jolt", "Tasha"),
    feature(15, "Improved Defender", "Tasha"),
  ],
})
