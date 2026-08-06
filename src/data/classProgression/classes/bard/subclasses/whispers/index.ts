import { defineSubclass, feature } from "../../../../builders"

export const whispers = defineSubclass({
  id: "whispers",
  name: "College of Whispers",
  className: "bard",
  source: "Xanathar",
  features: [
    feature(3, "Psychic Blades", "Xanathar"),
    feature(3, "Words of Terror", "Xanathar"),
    feature(6, "Mantle of Whispers", "Xanathar"),
    feature(14, "Shadow Lore", "Xanathar"),
  ],
})
