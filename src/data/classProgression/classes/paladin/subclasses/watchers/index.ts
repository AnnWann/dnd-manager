import { defineSubclass, feature } from "../../../../builders"

export const watchers = defineSubclass({
  id: "watchers",
  name: "Oath of the Watchers",
  className: "paladin",
  source: "Tasha",
  features: [
    feature(3, "Oath Spells", "Tasha"),
    feature(3, "Watcher's Will", "Tasha"),
    feature(3, "Abjure the Extraplanar", "Tasha"),
    feature(7, "Aura of the Sentinel", "Tasha"),
    feature(15, "Vigilant Rebuke", "Tasha"),
    feature(20, "Mortal Bulwark", "Tasha"),
  ],
})
