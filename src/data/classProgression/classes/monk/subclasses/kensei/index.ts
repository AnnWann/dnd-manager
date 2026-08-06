import { defineSubclass, feature } from "../../../../builders"

export const kensei = defineSubclass({
  id: "kensei",
  name: "Way of the Kensei",
  className: "monk",
  source: "Xanathar",
  features: [
    feature(3, "Path of the Kensei", "Xanathar", { choice: { id: "kensei-weapons-3", label: "Initial kensei weapons", kind: "subclass-option", count: 2, options: ["Battleaxe", "Longsword", "Warhammer", "Whip", "Longbow", "Shortbow", "Heavy Crossbow", "Hand Crossbow", "Light Crossbow"] } }),
    feature(6, "One with the Blade", "Xanathar", { choice: { id: "kensei-weapons-6", label: "Additional kensei weapon", kind: "subclass-option", count: 1, options: ["Battleaxe", "Longsword", "Warhammer", "Whip", "Longbow", "Shortbow", "Heavy Crossbow", "Hand Crossbow", "Light Crossbow"] } }),
    feature(11, "Sharpen the Blade", "Xanathar", { choice: { id: "kensei-weapons-11", label: "Additional kensei weapon", kind: "subclass-option", count: 1, options: ["Battleaxe", "Longsword", "Warhammer", "Whip", "Longbow", "Shortbow", "Heavy Crossbow", "Hand Crossbow", "Light Crossbow"] } }),
    feature(17, "Unerring Accuracy", "Xanathar", { choice: { id: "kensei-weapons-17", label: "Additional kensei weapon", kind: "subclass-option", count: 1, options: ["Battleaxe", "Longsword", "Warhammer", "Whip", "Longbow", "Shortbow", "Heavy Crossbow", "Hand Crossbow", "Light Crossbow"] } }),
  ],
})
