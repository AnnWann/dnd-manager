import type { CharacterType } from "../characters/CharacterType"
import type { Proficiency } from "./Proficiency"
import type { CharacterRace } from "../races/CharacterRace"
import type { CharacterAttribute } from "./CharacterAttribute"
import type { CharacterSkills } from "./CharacterSkills"
import type { CharacterClassInterface } from "./Class"
import type { HP } from "./HP"
import type { SavingThrowProficiencies } from "./SavingThrows"

export type Sheet = {
  stats: {
    armorClass: number
    mobility: number
    initiative: number
    passive_perception: number
    exhaustion?: number
    inspiration?: boolean
  }

  HP: HP

  attributes: CharacterAttribute
  skills: CharacterSkills
  savingThrowProficiencies: SavingThrowProficiencies
  proficiencies: Proficiency[]

  classes?: CharacterClassInterface[]
  race: CharacterRace
  type: CharacterType

  arms: number
}
