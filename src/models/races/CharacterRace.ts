import type { Ability } from "../abilities/Ability"
import type { Attribute } from "../sheet/Attribute"
import type { Race } from "./Race"

export type CharacterRace = {
  race: Race
  subrace: Subrace
  naturalAbilities: Ability[]
  attributeBonus: Record<Attribute, number>
  proficiencies: string[]
}

export type Subrace = Record<Race, string[]> 