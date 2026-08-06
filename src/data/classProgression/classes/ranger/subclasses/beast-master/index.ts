import { defineSubclass, feature } from "../../../../builders"

export const beastMaster = defineSubclass({
  id: "beast-master",
  name: "Beast Master",
  className: "ranger",
  source: "PHB",
  features: [
    feature(3, "Ranger's Companion"),
    feature(3, "Primal Companion", "Tasha", { optional: true }),
    feature(7, "Exceptional Training"),
    feature(11, "Bestial Fury"),
    feature(15, "Share Spells"),
  ],
})
