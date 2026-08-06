import { defineSubclass, feature } from "../../../../builders"

export const light = defineSubclass({
  id: "light",
  name: "Light Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Bonus Cantrip"),
    feature(1, "Warding Flare"),
    feature(2, "Radiance of the Dawn"),
    feature(6, "Improved Flare"),
    feature(8, "Potent Spellcasting"),
    feature(17, "Corona of Light"),
  ],
})
