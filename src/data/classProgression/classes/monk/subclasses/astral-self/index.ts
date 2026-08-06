import { defineSubclass, feature } from "../../../../builders"

export const astralSelf = defineSubclass({
  id: "astral-self",
  name: "Way of the Astral Self",
  className: "monk",
  source: "Tasha",
  features: [
    feature(3, "Arms of the Astral Self", "Tasha"),
    feature(6, "Visage of the Astral Self", "Tasha"),
    feature(11, "Body of the Astral Self", "Tasha"),
    feature(17, "Awakened Astral Self", "Tasha"),
  ],
})
