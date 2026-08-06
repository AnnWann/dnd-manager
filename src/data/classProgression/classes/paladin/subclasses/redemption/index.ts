import { defineSubclass, feature } from "../../../../builders"

export const redemption = defineSubclass({
  id: "redemption",
  name: "Oath of Redemption",
  className: "paladin",
  source: "Xanathar",
  features: [
    feature(3, "Oath Spells", "Xanathar"),
    feature(3, "Emissary of Peace", "Xanathar"),
    feature(3, "Rebuke the Violent", "Xanathar"),
    feature(7, "Aura of the Guardian", "Xanathar"),
    feature(15, "Protective Spirit", "Xanathar"),
    feature(20, "Emissary of Redemption", "Xanathar"),
  ],
})
