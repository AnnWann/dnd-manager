import { defineSubclass, feature } from "../../../../builders"

export const swords = defineSubclass({
  id: "swords",
  name: "College of Swords",
  className: "bard",
  source: "Xanathar",
  features: [
    feature(3, "Bonus Proficiencies", "Xanathar"),
    feature(3, "Fighting Style", "Xanathar", { choice: { id: "college-swords-fighting-style", label: "College of Swords fighting style", kind: "fighting-style", count: 1, options: ["Dueling", "Two-Weapon Fighting"] } }),
    feature(3, "Blade Flourish", "Xanathar"),
    feature(6, "Extra Attack", "Xanathar"),
    feature(14, "Master's Flourish", "Xanathar"),
  ],
})
