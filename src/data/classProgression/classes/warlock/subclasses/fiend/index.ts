import { defineSubclass, feature } from "../../../../builders"

export const fiend = defineSubclass({
  id: "fiend",
  name: "The Fiend",
  className: "warlock",
  source: "PHB",
  features: [
    feature(1, "Dark One's Blessing"),
    feature(6, "Dark One's Own Luck"),
    feature(10, "Fiendish Resilience"),
    feature(14, "Hurl Through Hell"),
  ],
})
