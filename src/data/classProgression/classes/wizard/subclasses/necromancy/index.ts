import { defineSubclass, feature } from "../../../../builders"

export const necromancy = defineSubclass({
  id: "necromancy",
  name: "School of Necromancy",
  className: "wizard",
  source: "PHB",
  features: [
    feature(2, "Necromancy Savant"),
    feature(2, "Grim Harvest"),
    feature(6, "Undead Thralls"),
    feature(10, "Inured to Undeath"),
    feature(14, "Command Undead"),
  ],
})
