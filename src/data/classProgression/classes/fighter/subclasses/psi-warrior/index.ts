import { defineSubclass, feature } from "../../../../builders"

export const psiWarrior = defineSubclass({
  id: "psi-warrior",
  name: "Psi Warrior",
  className: "fighter",
  source: "Tasha",
  features: [
    feature(3, "Psionic Power", "Tasha"),
    feature(7, "Telekinetic Adept", "Tasha"),
    feature(10, "Guarded Mind", "Tasha"),
    feature(15, "Bulwark of Force", "Tasha"),
    feature(18, "Telekinetic Master", "Tasha"),
  ],
})
