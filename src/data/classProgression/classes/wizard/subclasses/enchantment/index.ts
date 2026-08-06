import { defineSubclass, feature } from "../../../../builders"

export const enchantment = defineSubclass({
  id: "enchantment",
  name: "School of Enchantment",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Enchantment Savant"),
    feature(2, "Hypnotic Gaze"),
    feature(6, "Instinctive Charm"),
    feature(10, "Split Enchantment"),
    feature(14, "Alter Memories"),
  ],
})
