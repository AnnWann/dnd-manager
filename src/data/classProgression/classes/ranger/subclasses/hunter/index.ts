import { defineSubclass, feature } from "../../../../builders"

export const hunter = defineSubclass({
  id: "hunter",
  name: "Hunter",
  className: "ranger",
  source: "PHB",
  features: [
    feature(3, "Hunter's Prey", "PHB", { choice: { id: "hunter-prey-3", label: "Hunter's Prey", kind: "subclass-option", count: 1, options: ["Colossus Slayer", "Giant Killer", "Horde Breaker"] } }),
    feature(7, "Defensive Tactics", "PHB", { choice: { id: "hunter-defense-7", label: "Defensive Tactics", kind: "subclass-option", count: 1, options: ["Escape the Horde", "Multiattack Defense", "Steel Will"] } }),
    feature(11, "Multiattack", "PHB", { choice: { id: "hunter-multiattack-11", label: "Multiattack", kind: "subclass-option", count: 1, options: ["Volley", "Whirlwind Attack"] } }),
    feature(15, "Superior Hunter's Defense", "PHB", { choice: { id: "hunter-defense-15", label: "Superior Hunter's Defense", kind: "subclass-option", count: 1, options: ["Evasion", "Stand Against the Tide", "Uncanny Dodge"] } }),
  ],
})
