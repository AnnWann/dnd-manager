import { defineSubclass, feature } from "../../../../builders"

export const eldritchKnight = defineSubclass({
  id: "eldritch-knight",
  name: "Eldritch Knight",
  className: "fighter",
  source: "PHB",
  features: [
    feature(3, "Spellcasting"),
    feature(3, "Weapon Bond"),
    feature(7, "War Magic"),
    feature(10, "Eldritch Strike"),
    feature(15, "Arcane Charge"),
    feature(18, "Improved War Magic"),
  ],
})
