import { defineSubclass, feature } from "../../../../builders"

export const orderOfScribes = defineSubclass({
  id: "order-of-scribes",
  name: "Order of Scribes",
  className: "wizard",
  source: "Tasha",
  features: [
    feature(2, "Wizardly Quill", "Tasha"),
    feature(2, "Awakened Spellbook", "Tasha"),
    feature(6, "Manifest Mind", "Tasha"),
    feature(10, "Master Scrivener", "Tasha"),
    feature(14, "One with the Word", "Tasha"),
  ],
})
