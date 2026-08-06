import { defineSubclass, feature } from "../../../../builders"

export const wildMagic = defineSubclass({
  id: "wild-magic",
  name: "Wild Magic",
  className: "sorcerer",
  source: "PHB",
  features: [
    feature(1, "Wild Magic Surge"),
    feature(1, "Tides of Chaos"),
    feature(6, "Bend Luck"),
    feature(14, "Controlled Chaos"),
    feature(18, "Spell Bombardment"),
  ],
})
