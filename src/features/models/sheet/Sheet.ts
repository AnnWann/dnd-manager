import type { CharacterAttribute } from "./CharacterAttribute"
import type { CharacterSkills } from "./CharacterSkills"
import type { CharacterClass } from "./Class"
import type { HP } from "./HP"


export type Sheet = {
  HP: HP
  armorClass: number
  mobility: number
  attributes: CharacterAttribute
  skills: CharacterSkills
  classes?: CharacterClass
}