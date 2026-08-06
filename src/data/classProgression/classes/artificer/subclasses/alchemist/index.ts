import { defineSubclass, feature } from "../../../../builders"

export const alchemist = defineSubclass({
  id: "alchemist",
  name: "Alchemist",
  className: "artificer",
  source: "Tasha",
  features: [
    feature(3, "Tool Proficiency", "Tasha"),
    feature(3, "Alchemist Spells", "Tasha"),
    feature(3, "Experimental Elixir", "Tasha"),
    feature(5, "Alchemical Savant", "Tasha"),
    feature(9, "Restorative Reagents", "Tasha"),
    feature(15, "Chemical Mastery", "Tasha"),
  ],
})
