import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { rangerSubclasses } from "./subclasses"

const FIGHTING_STYLES = ["Archery", "Defense", "Dueling", "Two-Weapon Fighting", "Blind Fighting", "Druidic Warrior", "Interception", "Thrown Weapon Fighting"]

export const rangerProgression = defineClassProgression({
  className: "ranger",
  label: "Ranger",
  hitDie: "d10",
  source: "PHB",
  subclassLevel: 3,
  subclasses: rangerSubclasses,
  features: withAbilityScoreImprovements("ranger", [
    feature(1, "Favored Enemy"),
    feature(1, "Natural Explorer"),
    feature(1, "Deft Explorer", "Tasha", { optional: true }),
    feature(1, "Favored Foe", "Tasha", { optional: true }),
    feature(2, "Fighting Style", "PHB", { choice: { id: "ranger-style-2", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES } }),
    feature(2, "Spellcasting"),
    feature(2, "Spellcasting Focus", "Tasha", { optional: true }),
    feature(3, "Ranger Archetype"),
    feature(3, "Primeval Awareness"),
    feature(3, "Primal Awareness", "Tasha", { optional: true }),
    feature(4, "Martial Versatility", "Tasha", { optional: true }),
    feature(5, "Extra Attack"),
    feature(6, "Favored Enemy Improvement"),
    feature(6, "Natural Explorer Improvement"),
    feature(8, "Land's Stride"),
    feature(10, "Hide in Plain Sight"),
    feature(10, "Nature's Veil", "Tasha", { optional: true }),
    feature(14, "Vanish"),
    feature(14, "Favored Enemy Improvement"),
    feature(18, "Feral Senses"),
    feature(20, "Foe Slayer"),
  ]),
})
