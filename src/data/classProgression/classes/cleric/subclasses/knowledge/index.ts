import { defineSubclass, feature } from "../../../../builders"

export const knowledge = defineSubclass({
  id: "knowledge",
  name: "Knowledge Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Blessings of Knowledge"),
    feature(2, "Knowledge of the Ages"),
    feature(6, "Read Thoughts"),
    feature(8, "Potent Spellcasting"),
    feature(17, "Visions of the Past"),
  ],
})
