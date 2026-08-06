import { defineSubclass, feature } from "../../../../builders"

export const vengeance = defineSubclass({
  id: "vengeance",
  name: "Oath of Vengeance",
  className: "paladin",
  source: "PHB",
  features: [
    feature(3, "Oath Spells"),
    feature(3, "Abjure Enemy"),
    feature(3, "Vow of Enmity"),
    feature(7, "Relentless Avenger"),
    feature(15, "Soul of Vengeance"),
    feature(20, "Avenging Angel"),
  ],
})
