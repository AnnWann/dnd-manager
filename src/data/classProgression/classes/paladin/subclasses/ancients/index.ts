import { defineSubclass, feature } from "../../../../builders"

export const ancients = defineSubclass({
  id: "ancients",
  name: "Oath of the Ancients",
  className: "paladin",
  source: "PHB",
  features: [
    feature(3, "Oath Spells"),
    feature(3, "Nature's Wrath"),
    feature(3, "Turn the Faithless"),
    feature(7, "Aura of Warding"),
    feature(15, "Undying Sentinel"),
    feature(20, "Elder Champion"),
  ],
})
