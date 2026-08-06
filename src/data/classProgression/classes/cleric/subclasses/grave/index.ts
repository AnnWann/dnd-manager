import { defineSubclass, feature } from "../../../../builders"

export const grave = defineSubclass({
  id: "grave",
  name: "Grave Domain",
  className: "cleric",
  source: "Xanathar",
  features: [
    feature(1, "Circle of Mortality", "Xanathar"),
    feature(1, "Eyes of the Grave", "Xanathar"),
    feature(2, "Path to the Grave", "Xanathar"),
    feature(6, "Sentinel at Death's Door", "Xanathar"),
    feature(8, "Potent Spellcasting", "Xanathar"),
    feature(17, "Keeper of Souls", "Xanathar"),
  ],
})
