import { defineSubclass, feature } from "../../../../builders"

export const land = defineSubclass({
  id: "land",
  name: "Circle of the Land",
  className: "druid",
  source: "PHB",
  features: [
    feature(2, "Bonus Cantrip"),
    feature(2, "Natural Recovery"),
    feature(2, "Circle Spells", "PHB", { choice: { id: "circle-land-type", label: "Land type", kind: "subclass-option", count: 1, options: ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"] } }),
    feature(6, "Land's Stride"),
    feature(10, "Nature's Ward"),
    feature(14, "Nature's Sanctuary"),
  ],
})
