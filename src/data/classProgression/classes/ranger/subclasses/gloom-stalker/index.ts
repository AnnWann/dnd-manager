import { defineSubclass, feature } from "../../../../builders"

export const gloomStalker = defineSubclass({
  id: "gloom-stalker",
  name: "Gloom Stalker",
  className: "ranger",
  source: "Xanathar",
  features: [
    feature(3, "Gloom Stalker Magic", "Xanathar"),
    feature(3, "Dread Ambusher", "Xanathar"),
    feature(3, "Umbral Sight", "Xanathar"),
    feature(7, "Iron Mind", "Xanathar"),
    feature(11, "Stalker's Flurry", "Xanathar"),
    feature(15, "Shadowy Dodge", "Xanathar"),
  ],
})
