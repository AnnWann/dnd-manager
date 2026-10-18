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

export type RacialAttributeBonusRule =
  | "fixed"
  | "variant-1-1"
  | "flexible-2-1"
  | "flexible-1-1-1"
  | "custom"

export type RaceSupplyConsumption = {
  /** Standard food portions consumed per long rest. */
  food: number
  /** Standard drink portions consumed per long rest. */
  drink: number
}

export type CharacterRace = {
  race: Race
  /** Nome exibido quando a raça é personalizada. */
  customName?: string
  subrace: string
  naturalAbilities: Ability[]
  attributeBonus: Partial<Record<Attribute, number>>
  /** Regra usada para distribuir os bônus, preservada para futuras edições. */
  attributeBonusRule?: RacialAttributeBonusRule
  proficiencies: Proficiency[]
  size?: CreatureSize
  /** Mobilidade racial base em metros. */
  mobility?: number
  /** Campo legado mantido para personagens antigos. */
  speedBonus?: number
  /** Effective values saved for export and sync. */
  supplyConsumption?: RaceSupplyConsumption
  /** False/undefined means the values follow the automatic racial defaults. */
  supplyConsumptionCustomized?: boolean
}

export type Subrace = Partial<Record<Race, string[]>>
