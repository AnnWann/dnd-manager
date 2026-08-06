import { defineSubclass, feature } from "../../../../builders"

export const greatOldOne = defineSubclass({
  id: "great-old-one",
  name: "The Great Old One",
  className: "warlock",
  source: "PHB",
  features: [
    feature(1, "Awakened Mind"),
    feature(6, "Entropic Ward"),
    feature(10, "Thought Shield"),
    feature(14, "Create Thrall"),
  ],
})
