import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { clericSubclasses } from "./subclasses"

export const clericProgression = defineClassProgression({
  className: "cleric",
  label: "Cleric",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 1,
  cantripsKnown: { 1: 3, 4: 4, 10: 5 },
  subclasses: clericSubclasses,
  features: withAbilityScoreImprovements("cleric", [
    feature(1, "Spellcasting"),
    feature(1, "Divine Domain"),
    feature(2, "Channel Divinity"),
    feature(2, "Turn Undead"),
    feature(2, "Harness Divine Power", "Tasha", { optional: true }),
    feature(4, "Cantrip Versatility", "Tasha", { optional: true }),
    feature(5, "Destroy Undead"),
    feature(6, "Channel Divinity Improvement"),
    feature(8, "Destroy Undead Improvement"),
    feature(8, "Blessed Strikes", "Tasha", { optional: true }),
    feature(10, "Divine Intervention"),
    feature(11, "Destroy Undead Improvement"),
    feature(14, "Destroy Undead Improvement"),
    feature(17, "Destroy Undead Improvement"),
    feature(18, "Channel Divinity Improvement"),
    feature(20, "Improved Divine Intervention"),
  ]),
})
