import { defineSubclass, feature } from "../../../../builders"

export const beast = defineSubclass({
  id: "beast",
  name: "Path of the Beast",
  className: "barbarian",
  source: "Tasha",
  features: [
    feature(3, "Form of the Beast", "Tasha"),
    feature(6, "Bestial Soul", "Tasha"),
    feature(10, "Infectious Fury", "Tasha"),
    feature(14, "Call the Hunt", "Tasha"),
  ],
})
