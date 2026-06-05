import type { Ability } from "../abilities/Ability"
import type { ActionsPerTurn } from "../actions/Actions"
import type { CharacterEquipment } from "../items/equipment/Equipment"
import type { Itemmable } from "../items/item"
import type { Magic } from "../magic/Magic"
import type { Player } from "../player/Player"
import type { Sheet } from "../sheet/Sheet"


export interface CharacterTemplate {
  id: string,
  name: string
  sheet: Sheet
  actionsPerTurn: ActionsPerTurn
  deathSaves?: {
    successes: number
    failures: number
  }
  unique: boolean

  abilities?: Ability[]
  magic: Magic

  equipment: CharacterEquipment

  inventory: Itemmable[]

  notes: string[]

  owner: Player
  visibility: 'private' | 'party' | 'master'
}
