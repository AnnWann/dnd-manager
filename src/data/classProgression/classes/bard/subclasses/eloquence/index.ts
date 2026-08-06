import { defineSubclass, feature } from "../../../../builders"

export const eloquence = defineSubclass({
  id: "eloquence",
  name: "College of Eloquence",
  className: "bard",
  source: "Tasha",
  features: [
    feature(3, "Silver Tongue", "Tasha"),
    feature(3, "Unsettling Words", "Tasha"),
    feature(6, "Unfailing Inspiration", "Tasha"),
    feature(6, "Universal Speech", "Tasha"),
    feature(14, "Infectious Inspiration", "Tasha"),
  ],
})
