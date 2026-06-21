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

export type RaceSupplyConsumption = {
  /** Relative food consumption. 1 means the standard amount. */
  food: number
  /** Relative drink consumption. 1 means the standard amount. */
  drink: number
}

export type CharacterRace = {
  race: Race
  subrace: string
  naturalAbilities: Ability[]
  attributeBonus: Partial<Record<Attribute, number>>
  proficiencies: Proficiency[]
  size?: CreatureSize
  speedBonus?: number
  /** Stored now for future long-rest supply calculations. */
  supplyConsumption?: RaceSupplyConsumption
}

export type Subrace = Partial<Record<Race, string[]>>
