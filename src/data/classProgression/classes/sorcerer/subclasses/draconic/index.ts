import { defineSubclass, feature } from "../../../../builders"

export const draconic = defineSubclass({
  id: "draconic",
  name: "Draconic Bloodline",
  className: "sorcerer",
  source: "PHB",
  features: [
    feature(1, "Dragon Ancestor", "PHB", { choice: { id: "draconic-ancestry", label: "Dragon ancestry", kind: "subclass-option", count: 1, options: ["Black — acid", "Blue — lightning", "Brass — fire", "Bronze — lightning", "Copper — acid", "Gold — fire", "Green — poison", "Red — fire", "Silver — cold", "White — cold"] } }),
    feature(1, "Draconic Resilience"),
    feature(6, "Elemental Affinity"),
    feature(14, "Dragon Wings"),
    feature(18, "Draconic Presence"),
  ],
})
