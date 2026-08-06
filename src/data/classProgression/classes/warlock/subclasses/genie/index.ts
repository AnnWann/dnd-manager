import { defineSubclass, feature } from "../../../../builders"

export const genie = defineSubclass({
  id: "genie",
  name: "The Genie",
  className: "warlock",
  source: "Tasha",
  features: [
    feature(1, "Expanded Spell List", "Tasha"),
    feature(1, "Genie's Vessel", "Tasha", { choice: { id: "genie-kind", label: "Genie kind", kind: "subclass-option", count: 1, options: ["Dao", "Djinni", "Efreeti", "Marid"] } }),
    feature(6, "Elemental Gift", "Tasha"),
    feature(10, "Sanctuary Vessel", "Tasha"),
    feature(14, "Limited Wish", "Tasha"),
  ],
})
