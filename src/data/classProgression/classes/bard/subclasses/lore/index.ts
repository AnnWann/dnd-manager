import { defineSubclass, feature } from "../../../../builders"

export const lore = defineSubclass({
  id: "lore",
  name: "College of Lore",
  className: "bard",
  source: "PHB",
  features: [
    feature(3, "Bonus Proficiencies"),
    feature(3, "Cutting Words"),
    feature(6, "Additional Magical Secrets"),
    feature(14, "Peerless Skill"),
  ],
})
