import { defineSubclass, feature } from "../../../../builders"

export const stormHerald = defineSubclass({
  id: "storm-herald",
  name: "Path of the Storm Herald",
  className: "barbarian",
  source: "Xanathar",
  features: [
    feature(3, "Storm Aura", "Xanathar", { choice: { id: "storm-herald-environment", label: "Storm environment", kind: "subclass-option", count: 1, options: ["Desert", "Sea", "Tundra"] } }),
    feature(6, "Storm Soul", "Xanathar"),
    feature(10, "Shielding Storm", "Xanathar"),
    feature(14, "Raging Storm", "Xanathar"),
  ],
})
