import {
  defineClassProgression,
  feature,
  withAbilityScoreImprovements,
} from "../../builders"
import { warlockSubclasses } from "./subclasses"

const WARLOCK_INVOCATIONS = ["Agonizing Blast", "Armor of Shadows", "Ascendant Step", "Beast Speech", "Beguiling Influence", "Bewitching Whispers", "Book of Ancient Secrets", "Chains of Carceri", "Devil's Sight", "Dreadful Word", "Eldritch Mind", "Eldritch Sight", "Eldritch Spear", "Eyes of the Rune Keeper", "Fiendish Vigor", "Gaze of Two Minds", "Lifedrinker", "Mask of Many Faces", "Master of Myriad Forms", "Minions of Chaos", "Mire the Mind", "Misty Visions", "One with Shadows", "Otherworldly Leap", "Repelling Blast", "Sculptor of Flesh", "Sign of Ill Omen", "Thief of Five Fates", "Thirsting Blade", "Visions of Distant Realms", "Voice of the Chain Master", "Whispers of the Grave", "Witch Sight", "Bond of the Talisman", "Far Scribe", "Gift of the Protectors", "Investment of the Chain Master", "Protection of the Talisman", "Rebuke of the Talisman", "Undying Servitude"]

export const warlockProgression = defineClassProgression({
  className: "warlock",
  label: "Warlock",
  hitDie: "d8",
  source: "PHB",
  subclassLevel: 1,
  cantripsKnown: { 1: 2, 4: 3, 10: 4 },
  subclasses: warlockSubclasses,
  features: withAbilityScoreImprovements("warlock", [
    feature(1, "Otherworldly Patron"),
    feature(1, "Pact Magic"),
    feature(2, "Eldritch Invocations", "PHB", { choice: { id: "invocations-2", label: "Eldritch invocations", kind: "invocation", count: 2, options: WARLOCK_INVOCATIONS } }),
    feature(3, "Pact Boon", "PHB", { choice: { id: "pact-boon-3", label: "Pact boon", kind: "pact-boon", count: 1, options: ["Pact of the Chain", "Pact of the Blade", "Pact of the Tome", "Pact of the Talisman"] } }),
    feature(4, "Eldritch Versatility", "Tasha", { optional: true }),
    feature(5, "Additional Invocation", "PHB", { choice: { id: "invocations-5", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(7, "Additional Invocation", "PHB", { choice: { id: "invocations-7", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(9, "Additional Invocation", "PHB", { choice: { id: "invocations-9", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(11, "Mystic Arcanum (6th level)"),
    feature(12, "Additional Invocation", "PHB", { choice: { id: "invocations-12", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(13, "Mystic Arcanum (7th level)"),
    feature(15, "Mystic Arcanum (8th level)"),
    feature(15, "Additional Invocation", "PHB", { choice: { id: "invocations-15", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(17, "Mystic Arcanum (9th level)"),
    feature(18, "Additional Invocation", "PHB", { choice: { id: "invocations-18", label: "Additional invocation", kind: "invocation", count: 1, options: WARLOCK_INVOCATIONS } }),
    feature(20, "Eldritch Master"),
  ]),
})
