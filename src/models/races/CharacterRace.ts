import type { Ability } from "../abilities/Ability"
import type { Proficiency } from "../sheet/Proficiency"
import type { Attribute } from "../sheet/Attribute"
import type { Race } from "./Race"

export type CreatureSize =
  | "tiny"
  | "small"
  | "medium"
  | "large"
  | "huge"
  | "gargantuan"

export type CharacterRace = {
  race: Race
  subrace: string
  naturalAbilities: Ability[]
  attributeBonus: Partial<Record<Attribute, number>>
  proficiencies: Proficiency[]
  size?: CreatureSize
  speedBonus?: number
}

export type Subrace = Partial<Record<Race, string[]>>