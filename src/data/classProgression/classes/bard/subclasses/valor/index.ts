import { defineSubclass, feature } from "../../../../builders"

export const valor = defineSubclass({
  id: "valor",
  name: "College of Valor",
  className: "bard",
  source: "PHB",
  features: [
    feature(3, "Bonus Proficiencies"),
    feature(3, "Combat Inspiration"),
    feature(6, "Extra Attack"),
    feature(14, "Battle Magic"),
  ],
})
