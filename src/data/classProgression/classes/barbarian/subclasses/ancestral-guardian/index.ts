import { defineSubclass, feature } from "../../../../builders"

export const ancestralGuardian = defineSubclass({
  id: "ancestral-guardian",
  name: "Path of the Ancestral Guardian",
  className: "barbarian",
  source: "Xanathar",
  features: [
    feature(3, "Ancestral Protectors", "Xanathar"),
    feature(6, "Spirit Shield", "Xanathar"),
    feature(10, "Consult the Spirits", "Xanathar"),
    feature(14, "Vengeful Ancestors", "Xanathar"),
  ],
})
