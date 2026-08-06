import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { barbarianSubclasses } from "./subclasses"

export const barbarianProgression = defineClassProgression({
  className: "barbarian",
  label: "Barbarian",
  hitDie: "d12",
  source: "PHB",
  subclassLevel: 3,
  subclasses: barbarianSubclasses,
  features: withAbilityScoreImprovements("barbarian", [
    feature(1, "Rage"),
    feature(1, "Unarmored Defense"),
    feature(2, "Reckless Attack"),
    feature(2, "Danger Sense"),
    feature(3, "Primal Path"),
    feature(3, "Primal Knowledge", "Tasha", { optional: true }),
    feature(5, "Extra Attack"),
    feature(5, "Fast Movement"),
    feature(7, "Feral Instinct"),
    feature(7, "Instinctive Pounce", "Tasha", { optional: true }),
    feature(9, "Brutal Critical"),
    feature(11, "Relentless Rage"),
    feature(13, "Brutal Critical Improvement"),
    feature(15, "Persistent Rage"),
    feature(17, "Brutal Critical Improvement"),
    feature(18, "Indomitable Might"),
    feature(20, "Primal Champion"),
  ]),
})
