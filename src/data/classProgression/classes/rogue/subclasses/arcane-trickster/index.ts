import { defineSubclass, feature } from "../../../../builders"

export const arcaneTrickster = defineSubclass({
  id: "arcane-trickster",
  name: "Arcane Trickster",
  className: "rogue",
  source: "PHB",
  features: [
    feature(3, "Spellcasting"),
    feature(3, "Mage Hand Legerdemain"),
    feature(9, "Magical Ambush"),
    feature(13, "Versatile Trickster"),
    feature(17, "Spell Thief"),
  ],
})
