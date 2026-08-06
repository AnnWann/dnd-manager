import { defineSubclass, feature } from "../../../../builders"

const ARCANE_SHOTS = ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"]

export const arcaneArcher = defineSubclass({
  id: "arcane-archer",
  name: "Arcane Archer",
  className: "fighter",
  source: "Xanathar",
  features: [
    feature(3, "Arcane Archer Lore", "Xanathar"),
    feature(3, "Arcane Shot", "Xanathar", { choice: { id: "arcane-shot-options-3", label: "Arcane Shot options", kind: "subclass-option", count: 2, options: ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"] } }),
    feature(7, "Magic Arrow", "Xanathar"),
    feature(7, "Curving Shot", "Xanathar"),
    feature(7, "Additional Arcane Shot Option", "Xanathar", { choice: { id: "arcane-shot-options-7", label: "Additional Arcane Shot option", kind: "subclass-option", count: 1, options: ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"] } }),
    feature(10, "Additional Arcane Shot Option", "Xanathar", { choice: { id: "arcane-shot-options-10", label: "Additional Arcane Shot option", kind: "subclass-option", count: 1, options: ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"] } }),
    feature(15, "Ever-Ready Shot", "Xanathar"),
    feature(15, "Additional Arcane Shot Option", "Xanathar", { choice: { id: "arcane-shot-options-15", label: "Additional Arcane Shot option", kind: "subclass-option", count: 1, options: ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"] } }),
    feature(18, "Additional Arcane Shot Option", "Xanathar", { choice: { id: "arcane-shot-options-18", label: "Additional Arcane Shot option", kind: "subclass-option", count: 1, options: ["Banishing Arrow", "Beguiling Arrow", "Bursting Arrow", "Enfeebling Arrow", "Grasping Arrow", "Piercing Arrow", "Seeking Arrow", "Shadow Arrow"] } }),
  ],
})
