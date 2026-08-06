import { defineSubclass, feature } from "../../../../builders"

export const scout = defineSubclass({
  id: "scout",
  name: "Scout",
  className: "rogue",
  source: "Xanathar",
  features: [
    feature(3, "Skirmisher", "Xanathar"),
    feature(3, "Survivalist", "Xanathar"),
    feature(9, "Superior Mobility", "Xanathar"),
    feature(13, "Ambush Master", "Xanathar"),
    feature(17, "Sudden Strike", "Xanathar"),
  ],
})
