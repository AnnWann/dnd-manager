import { defineSubclass, feature } from "../../../../builders"

export const openHand = defineSubclass({
  id: "open-hand",
  name: "Way of the Open Hand",
  className: "monk",
  source: "PHB",
  features: [
    feature(3, "Open Hand Technique"),
    feature(6, "Wholeness of Body"),
    feature(11, "Tranquility"),
    feature(17, "Quivering Palm"),
  ],
})
