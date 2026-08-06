import { defineSubclass, feature } from "../../../../builders"

export const abjuration = defineSubclass({
  id: "abjuration",
  name: "School of Abjuration",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Abjuration Savant"),
    feature(2, "Arcane Ward"),
    feature(6, "Projected Ward"),
    feature(10, "Improved Abjuration"),
    feature(14, "Spell Resistance"),
  ],
})
