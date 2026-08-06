import { defineSubclass, feature } from "../../../../builders"

export const peace = defineSubclass({
  id: "peace",
  name: "Peace Domain",
  className: "cleric",
  source: "Tasha",
  features: [
    feature(1, "Implement of Peace", "Tasha"),
    feature(1, "Emboldening Bond", "Tasha"),
    feature(2, "Balm of Peace", "Tasha"),
    feature(6, "Protective Bond", "Tasha"),
    feature(8, "Potent Spellcasting", "Tasha"),
    feature(17, "Expansive Bond", "Tasha"),
  ],
})
