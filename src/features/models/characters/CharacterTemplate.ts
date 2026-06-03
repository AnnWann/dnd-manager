import type { Ability } from "../abilities.ts/Ability"
import type { ActionsPerTurn } from "../actions/Actions"
import type { Sheet } from "../sheet/Sheet"
import type { Resources as MagicResources } from "../resources/Resources"
import type { Spell } from "../magic/spells/Spell"

export interface CharacterTemplate {
  id: string,
  name: string
  sheet: Sheet
  actionsPerTurn: ActionsPerTurn
  
  abilities?: Ability[]
  magic: Magic
}

interface Magic {
  spells: Spell[]
  metamagic: Metamagic[]
  resources: MagicResources
}