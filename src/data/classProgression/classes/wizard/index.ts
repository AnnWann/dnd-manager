import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { wizardSubclasses } from "./subclasses"

export const wizardProgression = defineClassProgression({
  className: "wizard",
  label: "Wizard",
  hitDie: "d6",
  source: "PHB",
  subclassLevel: 2,
  cantripsKnown: { 1: 3, 4: 4, 10: 5 },
  subclasses: wizardSubclasses,
  features: withAbilityScoreImprovements("wizard", [
    feature(1, "Spellcasting"),
    feature(1, "Arcane Recovery"),
    feature(2, "Arcane Tradition"),
    feature(2, "Cantrip Formulas", "Tasha", { optional: true }),
    feature(18, "Spell Mastery"),
    feature(20, "Signature Spells"),
  ]),
})
