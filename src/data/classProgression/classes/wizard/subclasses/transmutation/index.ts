import { defineSubclass, feature } from "../../../../builders"

export const transmutation = defineSubclass({
  id: "transmutation",
  name: "School of Transmutation",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Transmutation Savant"),
    feature(2, "Minor Alchemy"),
    feature(6, "Transmuter's Stone"),
    feature(10, "Shapechanger"),
    feature(14, "Master Transmuter"),
  ],
})
