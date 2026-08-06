import { defineSubclass, feature } from "../../../../builders"

export const thief = defineSubclass({
  id: "thief",
  name: "Thief",
  className: "rogue",
  source: "PHB",
  features: [
    feature(3, "Fast Hands"),
    feature(3, "Second-Story Work"),
    feature(9, "Supreme Sneak"),
    feature(13, "Use Magic Device"),
    feature(17, "Thief's Reflexes"),
  ],
})
