import { defineSubclass, feature } from "../../../../builders"

export const hexblade = defineSubclass({
  id: "hexblade",
  name: "The Hexblade",
  className: "warlock",
  source: "Xanathar",
  features: [
    feature(1, "Expanded Spell List", "Xanathar"),
    feature(1, "Hexblade's Curse", "Xanathar"),
    feature(1, "Hex Warrior", "Xanathar"),
    feature(6, "Accursed Specter", "Xanathar"),
    feature(10, "Armor of Hexes", "Xanathar"),
    feature(14, "Master of Hexes", "Xanathar"),
  ],
})
