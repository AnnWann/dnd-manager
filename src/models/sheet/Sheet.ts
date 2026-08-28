import type { CharacterType } from "../characters/CharacterType"
import type { CharacterCondition } from "../characters/CharacterCondition"
import type { CharacterCustomSystemState } from "../customSystems/CustomSystem"
import type { Proficiency } from "./Proficiency"
import type { CharacterRace } from "../races/CharacterRace"
import type { CharacterAttribute } from "./CharacterAttribute"
import type { CharacterSkills } from "./CharacterSkills"
import type { CharacterClassInterface } from "./Class"
import type { HP } from "./HP"
import type { SavingThrowProficiencies } from "./SavingThrows"
import type { DamageAffinity } from "../combat/Damage"

export type Sheet = {
  stats: {
    armorClass: number
    mobility: number
    initiative: number
    passive_perception: number
    exhaustion?: number
    inspiration?: boolean
    experience?: number
    armorClassAdjustment?: number
    mobilityAdjustment?: number
    initiativeAdjustment?: number
    passivePerceptionAdjustment?: number
  }

  HP: HP
  conditions?: CharacterCondition[]
  damageAffinities?: DamageAffinity[]

  attributes: CharacterAttribute
  skills: CharacterSkills
  savingThrowProficiencies: SavingThrowProficiencies
  proficiencies: Proficiency[]

  classes?: CharacterClassInterface[]
  race: CharacterRace
  type: CharacterType

  customSystems?: CharacterCustomSystemState[]
  hiddenCharacterTabs?: string[]

  arms: number
}
