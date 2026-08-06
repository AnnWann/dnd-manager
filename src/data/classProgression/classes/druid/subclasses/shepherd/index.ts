import { defineSubclass, feature } from "../../../../builders"

export const shepherd = defineSubclass({
  id: "shepherd",
  name: "Circle of the Shepherd",
  className: "druid",
  source: "Xanathar",
  features: [
    feature(2, "Speech of the Woods", "Xanathar"),
    feature(2, "Spirit Totem", "Xanathar"),
    feature(6, "Mighty Summoner", "Xanathar"),
    feature(10, "Guardian Spirit", "Xanathar"),
    feature(14, "Faithful Summons", "Xanathar"),
  ],
})
