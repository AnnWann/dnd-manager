import { defineSubclass, feature } from "../../../../builders"

export const bladesinging = defineSubclass({
  id: "bladesinging",
  name: "Bladesinging",
  className: "wizard",
  source: "Tasha",
  features: [
    feature(2, "Training in War and Song", "Tasha"),
    feature(2, "Bladesong", "Tasha"),
    feature(6, "Extra Attack", "Tasha"),
    feature(10, "Song of Defense", "Tasha"),
    feature(14, "Song of Victory", "Tasha"),
  ],
})
