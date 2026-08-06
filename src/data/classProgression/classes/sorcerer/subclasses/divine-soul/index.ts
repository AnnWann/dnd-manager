import { defineSubclass, feature } from "../../../../builders"

export const divineSoul = defineSubclass({
  id: "divine-soul",
  name: "Divine Soul",
  className: "sorcerer",
  source: "Xanathar",
  features: [
    feature(1, "Divine Magic", "Xanathar", { choice: { id: "divine-soul-affinity", label: "Divine affinity", kind: "subclass-option", count: 1, options: ["Good", "Evil", "Law", "Chaos", "Neutrality"] } }),
    feature(1, "Favored by the Gods", "Xanathar"),
    feature(6, "Empowered Healing", "Xanathar"),
    feature(14, "Otherworldly Wings", "Xanathar"),
    feature(18, "Unearthly Recovery", "Xanathar"),
  ],
})
