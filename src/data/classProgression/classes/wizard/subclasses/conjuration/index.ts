import { defineSubclass, feature } from "../../../../builders"

export const conjuration = defineSubclass({
  id: "conjuration",
  name: "School of Conjuration",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Conjuration Savant"),
    feature(2, "Minor Conjuration"),
    feature(6, "Benign Transposition"),
    feature(10, "Focused Conjuration"),
    feature(14, "Durable Summons"),
  ],
})
