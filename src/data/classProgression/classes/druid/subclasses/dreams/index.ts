import { defineSubclass, feature } from "../../../../builders"

export const dreams = defineSubclass({
  id: "dreams",
  name: "Circle of Dreams",
  className: "druid",
  source: "Xanathar",
  features: [
    feature(2, "Balm of the Summer Court", "Xanathar"),
    feature(6, "Hearth of Moonlight and Shadow", "Xanathar"),
    feature(10, "Hidden Paths", "Xanathar"),
    feature(14, "Walker in Dreams", "Xanathar"),
  ],
})
