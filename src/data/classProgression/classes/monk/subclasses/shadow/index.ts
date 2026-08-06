import { defineSubclass, feature } from "../../../../builders"

export const shadow = defineSubclass({
  id: "shadow",
  name: "Way of Shadow",
  className: "monk",
  source: "PHB",
  features: [
    feature(3, "Shadow Arts"),
    feature(6, "Shadow Step"),
    feature(11, "Cloak of Shadows"),
    feature(17, "Opportunist"),
  ],
})
