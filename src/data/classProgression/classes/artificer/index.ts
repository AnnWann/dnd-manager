import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { artificerSubclasses } from "./subclasses"

const ARTIFICER_INFUSIONS = ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"]

export const artificerProgression = defineClassProgression({
  className: "artificer",
  label: "Artificer",
  hitDie: "d8",
  source: "Tasha",
  subclassLevel: 3,
  cantripsKnown: { 1: 2, 10: 3, 14: 4 },
  subclasses: artificerSubclasses,
  features: withAbilityScoreImprovements("artificer", [
    feature(1, "Magical Tinkering", "Tasha"),
    feature(1, "Spellcasting", "Tasha"),
    feature(2, "Infuse Item", "Tasha", { choice: { id: "artificer-infusions-2", label: "Infusions known", kind: "infusion", count: 4, options: ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"] } }),
    feature(3, "Artificer Specialist", "Tasha"),
    feature(3, "The Right Tool for the Job", "Tasha"),
    feature(5, "Specialist Feature", "Tasha"),
    feature(6, "Tool Expertise", "Tasha", { choice: { id: "artificer-infusions-6", label: "Additional infusions", kind: "infusion", count: 2, options: ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"] } }),
    feature(7, "Flash of Genius", "Tasha"),
    feature(9, "Specialist Feature", "Tasha"),
    feature(10, "Magic Item Adept", "Tasha", { choice: { id: "artificer-infusions-10", label: "Additional infusions", kind: "infusion", count: 2, options: ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"] } }),
    feature(11, "Spell-Storing Item", "Tasha"),
    feature(14, "Magic Item Savant", "Tasha", { choice: { id: "artificer-infusions-14", label: "Additional infusions", kind: "infusion", count: 2, options: ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"] } }),
    feature(15, "Specialist Feature", "Tasha"),
    feature(18, "Magic Item Master", "Tasha", { choice: { id: "artificer-infusions-18", label: "Additional infusions", kind: "infusion", count: 2, options: ["Arcane Propulsion Armor", "Armor of Magical Strength", "Boots of the Winding Path", "Enhanced Arcane Focus", "Enhanced Defense", "Enhanced Weapon", "Helm of Awareness", "Homunculus Servant", "Mind Sharpener", "Radiant Weapon", "Repeating Shot", "Replicate Magic Item", "Repulsion Shield", "Resistant Armor", "Returning Weapon", "Spell-Refueling Ring"] } }),
    feature(20, "Soul of Artifice", "Tasha"),
  ]),
})
