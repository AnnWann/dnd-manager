import { defineSubclass, feature } from "../../../../builders"

export const clockworkSoul = defineSubclass({
  id: "clockwork-soul",
  name: "Clockwork Soul",
  className: "sorcerer",
  source: "Tasha",
  features: [
    feature(1, "Clockwork Magic", "Tasha"),
    feature(1, "Restore Balance", "Tasha"),
    feature(6, "Bastion of Law", "Tasha"),
    feature(14, "Trance of Order", "Tasha"),
    feature(18, "Clockwork Cavalcade", "Tasha"),
  ],
})
