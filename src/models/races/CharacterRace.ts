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
  /** Standard food portions consumed per long rest. */
  food: number
  /** Standard drink portions consumed per long rest. */
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
  /** Effective values saved for export and sync. */
  supplyConsumption?: RaceSupplyConsumption
  /** False/undefined means the values follow the automatic racial defaults. */
  supplyConsumptionCustomized?: boolean
}

export type Subrace = Partial<Record<Race, string[]>>
