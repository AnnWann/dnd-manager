import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { rogueSubclasses } from "./subclasses"

export const rogueProgression = defineClassProgression({
  className: "rogue",
  label: "Rogue",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 3,
  subclasses: rogueSubclasses,
  features: withAbilityScoreImprovements("rogue", [
    feature(1, "Expertise", "PHB", { choice: { id: "rogue-expertise-1", label: "Expertise skills", kind: "expertise", count: 2 } }),
    feature(1, "Sneak Attack"),
    feature(1, "Thieves' Cant"),
    feature(2, "Cunning Action"),
    feature(3, "Roguish Archetype"),
    feature(3, "Steady Aim", "Tasha", { optional: true }),
    feature(5, "Uncanny Dodge"),
    feature(6, "Expertise", "PHB", { choice: { id: "rogue-expertise-6", label: "Expertise skills", kind: "expertise", count: 2 } }),
    feature(7, "Evasion"),
    feature(11, "Reliable Talent"),
    feature(14, "Blindsense"),
    feature(15, "Slippery Mind"),
    feature(18, "Elusive"),
    feature(20, "Stroke of Luck"),
  ]),
})
