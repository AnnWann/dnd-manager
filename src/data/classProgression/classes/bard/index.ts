import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { bardSubclasses } from "./subclasses"

export const bardProgression = defineClassProgression({
  className: "bard",
  label: "Bard",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 3,
  cantripsKnown: { 1: 2, 4: 3, 10: 4 },
  subclasses: bardSubclasses,
  features: withAbilityScoreImprovements("bard", [
    feature(1, "Spellcasting"),
    feature(1, "Bardic Inspiration"),
    feature(2, "Jack of All Trades"),
    feature(2, "Song of Rest"),
    feature(2, "Magical Inspiration", "Tasha", { optional: true }),
    feature(3, "Bard College"),
    feature(3, "Expertise", "PHB", { choice: { id: "bard-expertise-3", label: "Expertise skills", kind: "expertise", count: 2 } }),
    feature(4, "Bardic Versatility", "Tasha", { optional: true }),
    feature(5, "Font of Inspiration"),
    feature(5, "Bardic Inspiration Improvement"),
    feature(6, "Countercharm"),
    feature(9, "Song of Rest Improvement"),
    feature(10, "Expertise", "PHB", { choice: { id: "bard-expertise-10", label: "Expertise skills", kind: "expertise", count: 2 } }),
    feature(10, "Magical Secrets"),
    feature(10, "Bardic Inspiration Improvement"),
    feature(13, "Song of Rest Improvement"),
    feature(14, "Magical Secrets"),
    feature(15, "Bardic Inspiration Improvement"),
    feature(17, "Song of Rest Improvement"),
    feature(18, "Magical Secrets"),
    feature(20, "Superior Inspiration"),
  ]),
})
