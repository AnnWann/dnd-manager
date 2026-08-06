import { defineSubclass, feature } from "../../../../builders"

export const monsterSlayer = defineSubclass({
  id: "monster-slayer",
  name: "Monster Slayer",
  className: "ranger",
  source: "Xanathar",
  features: [
    feature(3, "Monster Slayer Magic", "Xanathar"),
    feature(3, "Hunter's Sense", "Xanathar"),
    feature(3, "Slayer's Prey", "Xanathar"),
    feature(7, "Supernatural Defense", "Xanathar"),
    feature(11, "Magic-User's Nemesis", "Xanathar"),
    feature(15, "Slayer's Counter", "Xanathar"),
  ],
})
