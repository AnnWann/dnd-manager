import { defineSubclass, feature } from "../../../../builders"

export const stormSorcery = defineSubclass({
  id: "storm-sorcery",
  name: "Storm Sorcery",
  className: "sorcerer",
  source: "Xanathar",
  features: [
    feature(1, "Wind Speaker", "Xanathar"),
    feature(1, "Tempestuous Magic", "Xanathar"),
    feature(6, "Heart of the Storm", "Xanathar"),
    feature(6, "Storm Guide", "Xanathar"),
    feature(14, "Storm's Fury", "Xanathar"),
    feature(18, "Wind Soul", "Xanathar"),
  ],
})
