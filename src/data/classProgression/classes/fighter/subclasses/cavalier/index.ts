import { defineSubclass, feature } from "../../../../builders"

export const cavalier = defineSubclass({
  id: "cavalier",
  name: "Cavalier",
  className: "fighter",
  source: "Xanathar",
  features: [
    feature(3, "Bonus Proficiency", "Xanathar"),
    feature(3, "Born to the Saddle", "Xanathar"),
    feature(3, "Unwavering Mark", "Xanathar"),
    feature(7, "Warding Maneuver", "Xanathar"),
    feature(10, "Hold the Line", "Xanathar"),
    feature(15, "Ferocious Charger", "Xanathar"),
    feature(18, "Vigilant Defender", "Xanathar"),
  ],
})
