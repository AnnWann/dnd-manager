import { defineSubclass, feature } from "../../../../builders"

export const feyWanderer = defineSubclass({
  id: "fey-wanderer",
  name: "Fey Wanderer",
  className: "ranger",
  source: "Tasha",
  features: [
    feature(3, "Dreadful Strikes", "Tasha"),
    feature(3, "Fey Wanderer Magic", "Tasha"),
    feature(3, "Otherworldly Glamour", "Tasha"),
    feature(7, "Beguiling Twist", "Tasha"),
    feature(11, "Fey Reinforcements", "Tasha"),
    feature(15, "Misty Wanderer", "Tasha"),
  ],
})
