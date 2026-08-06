import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { fighterSubclasses } from "./subclasses"

const FIGHTING_STYLES = ["Archery", "Defense", "Dueling", "Great Weapon Fighting", "Protection", "Two-Weapon Fighting", "Blind Fighting", "Interception", "Superior Technique", "Thrown Weapon Fighting", "Unarmed Fighting"]

export const fighterProgression = defineClassProgression({
  className: "fighter",
  label: "Fighter",
  hitDie: "d10",
  source: "PHB",
  subclassLevel: 3,
  subclasses: fighterSubclasses,
  features: withAbilityScoreImprovements("fighter", [
    feature(1, "Fighting Style", "PHB", { choice: { id: "fighter-style-1", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES } }),
    feature(1, "Second Wind"),
    feature(2, "Action Surge"),
    feature(3, "Martial Archetype"),
    feature(4, "Martial Versatility", "Tasha", { optional: true }),
    feature(5, "Extra Attack"),
    feature(9, "Indomitable"),
    feature(10, "Additional Fighting Style", "PHB", { choice: { id: "fighter-style-10", label: "Additional fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES } }),
    feature(11, "Extra Attack Improvement"),
    feature(13, "Indomitable Improvement"),
    feature(17, "Action Surge Improvement"),
    feature(17, "Indomitable Improvement"),
    feature(20, "Extra Attack Improvement"),
  ]),
})
