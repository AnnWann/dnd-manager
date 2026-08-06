import { defineSubclass, feature } from "../../../../builders"

export const aberrantMind = defineSubclass({
  id: "aberrant-mind",
  name: "Aberrant Mind",
  className: "sorcerer",
  source: "Tasha",
  features: [
    feature(1, "Psionic Spells", "Tasha"),
    feature(1, "Telepathic Speech", "Tasha"),
    feature(6, "Psionic Sorcery", "Tasha"),
    feature(6, "Psychic Defenses", "Tasha"),
    feature(14, "Revelation in Flesh", "Tasha"),
    feature(18, "Warping Implosion", "Tasha"),
  ],
})
