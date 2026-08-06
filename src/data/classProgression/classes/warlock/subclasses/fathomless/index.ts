import { defineSubclass, feature } from "../../../../builders"

export const fathomless = defineSubclass({
  id: "fathomless",
  name: "The Fathomless",
  className: "warlock",
  source: "Tasha",
  features: [
    feature(1, "Expanded Spell List", "Tasha"),
    feature(1, "Tentacle of the Deeps", "Tasha"),
    feature(1, "Gift of the Sea", "Tasha"),
    feature(6, "Oceanic Soul", "Tasha"),
    feature(6, "Guardian Coil", "Tasha"),
    feature(10, "Grasping Tentacles", "Tasha"),
    feature(14, "Fathomless Plunge", "Tasha"),
  ],
})
