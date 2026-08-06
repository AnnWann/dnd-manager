import { defineSubclass, feature } from "../../../../builders"

export const illusion = defineSubclass({
  id: "illusion",
  name: "School of Illusion",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Illusion Savant"),
    feature(2, "Improved Minor Illusion"),
    feature(6, "Malleable Illusions"),
    feature(10, "Illusory Self"),
    feature(14, "Illusory Reality"),
  ],
})
