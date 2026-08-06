import { defineSubclass, feature } from "../../../../builders"

export const twilight = defineSubclass({
  id: "twilight",
  name: "Twilight Domain",
  className: "cleric",
  source: "Tasha",
  features: [
    feature(1, "Bonus Proficiencies", "Tasha"),
    feature(1, "Eyes of Night", "Tasha"),
    feature(1, "Vigilant Blessing", "Tasha"),
    feature(2, "Twilight Sanctuary", "Tasha"),
    feature(6, "Steps of Night", "Tasha"),
    feature(8, "Divine Strike", "Tasha"),
    feature(17, "Twilight Shroud", "Tasha"),
  ],
})
