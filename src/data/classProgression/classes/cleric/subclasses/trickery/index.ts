import { defineSubclass, feature } from "../../../../builders"

export const trickery = defineSubclass({
  id: "trickery",
  name: "Trickery Domain",
  className: "cleric",
  source: "PHB",
  features: [
    feature(1, "Blessing of the Trickster"),
    feature(2, "Invoke Duplicity"),
    feature(6, "Cloak of Shadows"),
    feature(8, "Divine Strike"),
    feature(17, "Improved Duplicity"),
  ],
})
