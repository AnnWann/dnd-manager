import { defineSubclass, feature } from "../../../../builders"

export const mastermind = defineSubclass({
  id: "mastermind",
  name: "Mastermind",
  className: "rogue",
  source: "Xanathar",
  features: [
    feature(3, "Master of Intrigue", "Xanathar"),
    feature(3, "Master of Tactics", "Xanathar"),
    feature(9, "Insightful Manipulator", "Xanathar"),
    feature(13, "Misdirection", "Xanathar"),
    feature(17, "Soul of Deceit", "Xanathar"),
  ],
})
