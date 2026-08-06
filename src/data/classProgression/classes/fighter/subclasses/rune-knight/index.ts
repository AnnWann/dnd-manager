import { defineSubclass, feature } from "../../../../builders"

const RUNE_KNIGHT_RUNES = ["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"]

export const runeKnight = defineSubclass({
  id: "rune-knight",
  name: "Rune Knight",
  className: "fighter",
  source: "Tasha",
  features: [
    feature(3, "Bonus Proficiencies", "Tasha"),
    feature(3, "Rune Carver", "Tasha", { choice: { id: "rune-knight-runes-3", label: "Runes", kind: "rune", count: 2, options: ["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"] } }),
    feature(3, "Giant's Might", "Tasha"),
    feature(7, "Runic Shield", "Tasha", { choice: { id: "rune-knight-runes-7", label: "Additional rune", kind: "rune", count: 1, options: ["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"] } }),
    feature(10, "Great Stature", "Tasha", { choice: { id: "rune-knight-runes-10", label: "Additional rune", kind: "rune", count: 1, options: ["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"] } }),
    feature(15, "Master of Runes", "Tasha", { choice: { id: "rune-knight-runes-15", label: "Additional rune", kind: "rune", count: 1, options: ["Cloud Rune", "Fire Rune", "Frost Rune", "Stone Rune", "Hill Rune", "Storm Rune"] } }),
    feature(18, "Runic Juggernaut", "Tasha"),
  ],
})
