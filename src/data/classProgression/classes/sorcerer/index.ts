import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { sorcererSubclasses } from "./subclasses"

export const sorcererProgression = defineClassProgression({
  className: "sorcerer",
  label: "Sorcerer",
  hitDie: "d6",
  source: "PHB",
  subclassLevel: 1,
  cantripsKnown: { 1: 4, 4: 5, 10: 6 },
  subclasses: sorcererSubclasses,
  features: withAbilityScoreImprovements("sorcerer", [
    feature(1, "Spellcasting"),
    feature(1, "Sorcerous Origin"),
    feature(2, "Font of Magic"),
    feature(3, "Metamagic", "PHB", { choice: { id: "metamagic-3", label: "Metamagic options", kind: "metamagic", count: 2 } }),
    feature(4, "Sorcerous Versatility", "Tasha", { optional: true }),
    feature(6, "Sorcerous Origin Feature"),
    feature(10, "Metamagic", "PHB", { choice: { id: "metamagic-10", label: "Additional metamagic", kind: "metamagic", count: 1 } }),
    feature(14, "Sorcerous Origin Feature"),
    feature(17, "Metamagic", "PHB", { choice: { id: "metamagic-17", label: "Additional metamagic", kind: "metamagic", count: 1 } }),
    feature(18, "Sorcerous Origin Feature"),
    feature(20, "Sorcerous Restoration"),
  ]),
})
