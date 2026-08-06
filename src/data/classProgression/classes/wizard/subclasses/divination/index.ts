import { defineSubclass, feature } from "../../../../builders"

export const divination = defineSubclass({
  id: "divination",
  name: "School of Divination",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Divination Savant"),
    feature(2, "Portent"),
    feature(6, "Expert Divination"),
    feature(10, "The Third Eye"),
    feature(14, "Greater Portent"),
  ],
})
