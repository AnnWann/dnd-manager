import { defineSubclass, feature } from "../../../../builders"

export const swashbuckler = defineSubclass({
  id: "swashbuckler",
  name: "Swashbuckler",
  className: "rogue",
  source: "Xanathar",
  features: [
    feature(3, "Fancy Footwork", "Xanathar"),
    feature(3, "Rakish Audacity", "Xanathar"),
    feature(9, "Panache", "Xanathar"),
    feature(13, "Elegant Maneuver", "Xanathar"),
    feature(17, "Master Duelist", "Xanathar"),
  ],
})
