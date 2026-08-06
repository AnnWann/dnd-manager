import { defineSubclass, feature } from "../../../../builders"

export const glory = defineSubclass({
  id: "glory",
  name: "Oath of Glory",
  className: "paladin",
  source: "Tasha",
  features: [
    feature(3, "Oath Spells", "Tasha"),
    feature(3, "Peerless Athlete", "Tasha"),
    feature(3, "Inspiring Smite", "Tasha"),
    feature(7, "Aura of Alacrity", "Tasha"),
    feature(15, "Glorious Defense", "Tasha"),
    feature(20, "Living Legend", "Tasha"),
  ],
})
