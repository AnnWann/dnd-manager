import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { paladinSubclasses } from "./subclasses"

const FIGHTING_STYLES = ["Defense", "Dueling", "Great Weapon Fighting", "Protection", "Blessed Warrior", "Blind Fighting", "Interception"]

export const paladinProgression = defineClassProgression({
  className: "paladin",
  label: "Paladin",
  hitDie: "d10",
  source: "PHB",
  subclassLevel: 3,
  subclasses: paladinSubclasses,
  features: withAbilityScoreImprovements("paladin", [
    feature(1, "Divine Sense"),
    feature(1, "Lay on Hands"),
    feature(2, "Fighting Style", "PHB", { choice: { id: "paladin-style-2", label: "Fighting style", kind: "fighting-style", count: 1, options: FIGHTING_STYLES } }),
    feature(2, "Spellcasting"),
    feature(2, "Divine Smite"),
    feature(3, "Divine Health"),
    feature(3, "Sacred Oath"),
    feature(3, "Harness Divine Power", "Tasha", { optional: true }),
    feature(4, "Martial Versatility", "Tasha", { optional: true }),
    feature(5, "Extra Attack"),
    feature(6, "Aura of Protection"),
    feature(10, "Aura of Courage"),
    feature(11, "Improved Divine Smite"),
    feature(14, "Cleansing Touch"),
    feature(18, "Aura Improvements"),
  ]),
})
