import { defineSubclass, feature } from "../../../../builders"

export const glamour = defineSubclass({
  id: "glamour",
  name: "College of Glamour",
  className: "bard",
  source: "Xanathar",
  features: [
    feature(3, "Mantle of Inspiration", "Xanathar"),
    feature(3, "Enthralling Performance", "Xanathar"),
    feature(6, "Mantle of Majesty", "Xanathar"),
    feature(14, "Unbreakable Majesty", "Xanathar"),
  ],
})
