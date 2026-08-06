import { defineSubclass, feature } from "../../../../builders"

export const archfey = defineSubclass({
  id: "archfey",
  name: "The Archfey",
  className: "warlock",
  source: "PHB",
  features: [
    feature(1, "Fey Presence"),
    feature(6, "Misty Escape"),
    feature(10, "Beguiling Defenses"),
    feature(14, "Dark Delirium"),
  ],
})
