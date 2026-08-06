import { defineSubclass, feature } from "../../../../builders"

export const spores = defineSubclass({
  id: "spores",
  name: "Circle of Spores",
  className: "druid",
  source: "Tasha",
  features: [
    feature(2, "Circle Spells", "Tasha"),
    feature(2, "Halo of Spores", "Tasha"),
    feature(2, "Symbiotic Entity", "Tasha"),
    feature(6, "Fungal Infestation", "Tasha"),
    feature(10, "Spreading Spores", "Tasha"),
    feature(14, "Fungal Body", "Tasha"),
  ],
})
