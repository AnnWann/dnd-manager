import { defineSubclass, feature } from "../../../../builders"

export const forge = defineSubclass({
  id: "forge",
  name: "Forge Domain",
  className: "cleric",
  source: "Xanathar",
  features: [
    feature(1, "Bonus Proficiencies", "Xanathar"),
    feature(1, "Blessing of the Forge", "Xanathar"),
    feature(2, "Artisan's Blessing", "Xanathar"),
    feature(6, "Soul of the Forge", "Xanathar"),
    feature(8, "Divine Strike", "Xanathar"),
    feature(17, "Saint of Forge and Fire", "Xanathar"),
  ],
})
