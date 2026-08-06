import { defineSubclass, feature } from "../../../../builders"

export const moon = defineSubclass({
  id: "moon",
  name: "Circle of the Moon",
  className: "druid",
  source: "PHB",
  features: [
    feature(2, "Combat Wild Shape"),
    feature(2, "Circle Forms"),
    feature(6, "Primal Strike"),
    feature(10, "Elemental Wild Shape"),
    feature(14, "Thousand Forms"),
  ],
})
