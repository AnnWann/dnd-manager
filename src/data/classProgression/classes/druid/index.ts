import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { druidSubclasses } from "./subclasses"

export const druidProgression = defineClassProgression({
  className: "druid",
  label: "Druid",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 2,
  cantripsKnown: { 1: 2, 4: 3, 10: 4 },
  subclasses: druidSubclasses,
  features: withAbilityScoreImprovements("druid", [
    feature(1, "Druidic"),
    feature(1, "Spellcasting"),
    feature(2, "Wild Shape"),
    feature(2, "Druid Circle"),
    feature(2, "Wild Companion", "Tasha", { optional: true }),
    feature(4, "Wild Shape Improvement"),
    feature(4, "Cantrip Versatility", "Tasha", { optional: true }),
    feature(8, "Wild Shape Improvement"),
    feature(18, "Timeless Body"),
    feature(18, "Beast Spells"),
    feature(20, "Archdruid"),
  ]),
})
