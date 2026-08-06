import { defineSubclass, feature } from "../../../../builders"

export const mercy = defineSubclass({
  id: "mercy",
  name: "Way of Mercy",
  className: "monk",
  source: "Tasha",
  features: [
    feature(3, "Implements of Mercy", "Tasha"),
    feature(3, "Hand of Healing", "Tasha"),
    feature(3, "Hand of Harm", "Tasha"),
    feature(6, "Physician's Touch", "Tasha"),
    feature(11, "Flurry of Healing and Harm", "Tasha"),
    feature(17, "Hand of Ultimate Mercy", "Tasha"),
  ],
})
