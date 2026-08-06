import { defineSubclass, feature } from "../../../../builders"

export const order = defineSubclass({
  id: "order",
  name: "Order Domain",
  className: "cleric",
  source: "Tasha",
  features: [
    feature(1, "Bonus Proficiencies", "Tasha"),
    feature(1, "Voice of Authority", "Tasha"),
    feature(2, "Order's Demand", "Tasha"),
    feature(6, "Embodiment of the Law", "Tasha"),
    feature(8, "Divine Strike", "Tasha"),
    feature(17, "Order's Wrath", "Tasha"),
  ],
})
