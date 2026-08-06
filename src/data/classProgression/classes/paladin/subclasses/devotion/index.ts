import { defineSubclass, feature } from "../../../../builders"

export const devotion = defineSubclass({
  id: "devotion",
  name: "Oath of Devotion",
  className: "paladin",
  source: "PHB",
  features: [
    feature(3, "Oath Spells"),
    feature(3, "Sacred Weapon"),
    feature(3, "Turn the Unholy"),
    feature(7, "Aura of Devotion"),
    feature(15, "Purity of Spirit"),
    feature(20, "Holy Nimbus"),
  ],
})
