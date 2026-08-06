import { defineSubclass, feature } from "../../../../builders"

export const evocation = defineSubclass({
  id: "evocation",
  name: "School of Evocation",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Evocation Savant"),
    feature(2, "Sculpt Spells"),
    feature(6, "Potent Cantrip"),
    feature(10, "Empowered Evocation"),
    feature(14, "Overchannel"),
  ],
})
