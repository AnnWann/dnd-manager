import type { CharacterType } from "../characters/CharacterType"
import type { CharacterRace } from "../races/CharacterRace"
import type { CharacterAttribute } from "./CharacterAttribute"
import type { CharacterSkills } from "./CharacterSkills"
import type { CharacterClassInterface } from "./Class"
import type { HP } from "./HP"


export type Sheet = {
  stats: {
    armorClass: number
    mobility: number
    initiative: number
    passive_perception: number
  }
  HP: HP
  attributes: CharacterAttribute
  skills: CharacterSkills

  classes?: CharacterClassInterface[]
  race: CharacterRace
  type: CharacterType

  arms: number

}
