import { defineSubclass, feature } from "../../../../builders"

export const samurai = defineSubclass({
  id: "samurai",
  name: "Samurai",
  className: "fighter",
  source: "Xanathar",
  features: [
    feature(3, "Bonus Proficiency", "Xanathar"),
    feature(3, "Fighting Spirit", "Xanathar"),
    feature(7, "Elegant Courtier", "Xanathar"),
    feature(10, "Tireless Spirit", "Xanathar"),
    feature(15, "Rapid Strike", "Xanathar"),
    feature(18, "Strength Before Death", "Xanathar"),
  ],
})
