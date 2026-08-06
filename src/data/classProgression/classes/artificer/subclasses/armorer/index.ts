import { defineSubclass, feature } from "../../../../builders"

export const armorer = defineSubclass({
  id: "armorer",
  name: "Armorer",
  className: "artificer",
  source: "Tasha",
  features: [
    feature(3, "Tools of the Trade", "Tasha"),
    feature(3, "Armorer Spells", "Tasha"),
    feature(3, "Arcane Armor", "Tasha"),
    feature(3, "Armor Model", "Tasha"),
    feature(5, "Extra Attack", "Tasha"),
    feature(9, "Armor Modifications", "Tasha"),
    feature(15, "Perfected Armor", "Tasha"),
  ],
})
