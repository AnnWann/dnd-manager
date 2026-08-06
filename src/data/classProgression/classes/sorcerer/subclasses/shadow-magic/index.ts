import { defineSubclass, feature } from "../../../../builders"

export const shadowMagic = defineSubclass({
  id: "shadow-magic",
  name: "Shadow Magic",
  className: "sorcerer",
  source: "Xanathar",
  features: [
    feature(1, "Eyes of the Dark", "Xanathar"),
    feature(1, "Strength of the Grave", "Xanathar"),
    feature(6, "Hound of Ill Omen", "Xanathar"),
    feature(14, "Shadow Walk", "Xanathar"),
    feature(18, "Umbral Form", "Xanathar"),
  ],
})
