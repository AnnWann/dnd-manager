import { defineSubclass, feature } from "../../../../builders"

export const sunSoul = defineSubclass({
  id: "sun-soul",
  name: "Way of the Sun Soul",
  className: "monk",
  source: "Xanathar",
  features: [
    feature(3, "Radiant Sun Bolt", "Xanathar"),
    feature(6, "Searing Arc Strike", "Xanathar"),
    feature(11, "Searing Sunburst", "Xanathar"),
    feature(17, "Sun Shield", "Xanathar"),
  ],
})
