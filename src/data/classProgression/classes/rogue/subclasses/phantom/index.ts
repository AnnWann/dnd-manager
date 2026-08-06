import { defineSubclass, feature } from "../../../../builders"

export const phantom = defineSubclass({
  id: "phantom",
  name: "Phantom",
  className: "rogue",
  source: "Tasha",
  features: [
    feature(3, "Whispers of the Dead", "Tasha"),
    feature(3, "Wails from the Grave", "Tasha"),
    feature(9, "Tokens of the Departed", "Tasha"),
    feature(13, "Ghost Walk", "Tasha"),
    feature(17, "Death's Friend", "Tasha"),
  ],
})
