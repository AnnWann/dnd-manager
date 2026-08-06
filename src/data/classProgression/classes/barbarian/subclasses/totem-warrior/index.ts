import { defineSubclass, feature } from "../../../../builders"

export const totemWarrior = defineSubclass({
  id: "totem-warrior",
  name: "Path of the Totem Warrior",
  className: "barbarian",
  source: "PHB",
  features: [
    feature(3, "Spirit Seeker"),
    feature(3, "Totem Spirit", "PHB", { choice: { id: "totem-spirit-3", label: "Totem spirit", kind: "subclass-option", count: 1, options: ["Bear", "Eagle", "Wolf"] } }),
    feature(6, "Aspect of the Beast", "PHB", { choice: { id: "totem-aspect-6", label: "Bestial aspect", kind: "subclass-option", count: 1, options: ["Bear", "Eagle", "Wolf"] } }),
    feature(10, "Spirit Walker"),
    feature(14, "Totemic Attunement", "PHB", { choice: { id: "totem-attunement-14", label: "Totemic attunement", kind: "subclass-option", count: 1, options: ["Bear", "Eagle", "Wolf"] } }),
  ],
})
