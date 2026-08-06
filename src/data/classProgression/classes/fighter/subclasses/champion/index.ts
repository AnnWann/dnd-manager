import { defineSubclass, feature } from "../../../../builders"

export const champion = defineSubclass({
  id: "champion",
  name: "Champion",
  className: "fighter",
  source: "PHB",
  features: [
    feature(3, "Improved Critical"),
    feature(7, "Remarkable Athlete"),
    feature(10, "Additional Fighting Style"),
    feature(15, "Superior Critical"),
    feature(18, "Survivor"),
  ],
})
