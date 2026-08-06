import { defineSubclass, feature } from "../../../../builders"

export const wildfire = defineSubclass({
  id: "wildfire",
  name: "Circle of Wildfire",
  className: "druid",
  source: "Tasha",
  features: [
    feature(2, "Circle Spells", "Tasha"),
    feature(2, "Summon Wildfire Spirit", "Tasha"),
    feature(6, "Enhanced Bond", "Tasha"),
    feature(10, "Cauterizing Flames", "Tasha"),
    feature(14, "Blazing Revival", "Tasha"),
  ],
})
