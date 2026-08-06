import { defineSubclass, feature } from "../../../../builders"

export const creation = defineSubclass({
  id: "creation",
  name: "College of Creation",
  className: "bard",
  source: "Tasha",
  features: [
    feature(3, "Mote of Potential", "Tasha"),
    feature(3, "Performance of Creation", "Tasha"),
    feature(6, "Animating Performance", "Tasha"),
    feature(14, "Creative Crescendo", "Tasha"),
  ],
})
