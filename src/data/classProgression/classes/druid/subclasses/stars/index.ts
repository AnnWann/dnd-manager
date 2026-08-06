import { defineSubclass, feature } from "../../../../builders"

export const stars = defineSubclass({
  id: "stars",
  name: "Circle of Stars",
  className: "druid",
  source: "Tasha",
  features: [
    feature(2, "Star Map", "Tasha"),
    feature(2, "Starry Form", "Tasha"),
    feature(6, "Cosmic Omen", "Tasha"),
    feature(10, "Twinkling Constellations", "Tasha"),
    feature(14, "Full of Stars", "Tasha"),
  ],
})
