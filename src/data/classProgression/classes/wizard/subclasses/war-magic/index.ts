import { defineSubclass, feature } from "../../../../builders"

export const warMagic = defineSubclass({
  id: "war-magic",
  name: "War Magic",
  className: "wizard",
  source: "Xanathar",
  features: [
    feature(2, "Arcane Deflection", "Xanathar"),
    feature(2, "Tactical Wit", "Xanathar"),
    feature(6, "Power Surge", "Xanathar"),
    feature(10, "Durable Magic", "Xanathar"),
    feature(14, "Deflecting Shroud", "Xanathar"),
  ],
})
